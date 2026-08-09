import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, ShieldCheck, User as UserIcon, Users as UsersIcon, SearchX,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useFleet } from '../context/FleetContext.jsx';
import {
  Button, IconButton, Badge, Modal, EmptyState, PageHeader, SearchInput,
  Field, FieldRow, Input, Select, PasswordInput, Checkbox, Alert, Skeleton,
  TableWrap, Table, THead, TBody, TH, TR, TD, useToast, useConfirm,
} from '../components/ui';
import { relTime, num, plural } from '../lib/format';
import cn from '../lib/cn';

const EMPTY = { username: '', email: '', password: '', role: 'USER', clientIds: [] };

/**
 * User administration.
 *
 * The important thing this screen has to communicate is not who exists but
 * what each account can reach. Previously that was a bare number in a column
 * — "3" — which told you nothing about whether the right three. Roles are now
 * described in words on the row, and the editor states the consequence of the
 * role choice as you make it rather than leaving you to infer it.
 */
export default function Users() {
  const { user: me } = useAuth();
  const { clients } = useFleet();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // user object or 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      const { data } = await api.get('/users');
      setUsers(data.users || []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'The user list could not be loaded.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(t) ||
        (u.email || '').toLowerCase().includes(t) ||
        u.role.toLowerCase().includes(t)
    );
  }, [users, q]);

  const adminCount = users.filter((u) => u.role === 'ADMIN' && u.active !== false).length;

  function openEditor(u) {
    setEditing(u || 'new');
    setForm(
      u
        ? { username: u.username, email: u.email || '', password: '', role: u.role, clientIds: u.clientIds || [] }
        : EMPTY
    );
    setErr('');
  }

  const editingUser = editing && editing !== 'new' ? editing : null;

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!editingUser && form.password.length < 8) {
      setErr('The password must be at least 8 characters.');
      return;
    }
    if (editingUser && form.password && form.password.length < 8) {
      setErr('The new password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const payload = { email: form.email || null, role: form.role, clientIds: form.clientIds };
        if (form.password) payload.password = form.password;
        await api.patch(`/users/${editingUser.id}`, payload);
        toast.success(`${editingUser.username} updated.`);
      } else {
        await api.post('/users', {
          username: form.username.trim(),
          email: form.email || null,
          password: form.password,
          role: form.role,
          clientIds: form.clientIds,
        });
        toast.success(`${form.username.trim()} created.`);
      }
      setEditing(null);
      load();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'This account could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(u) {
    const ok = await confirm({
      title: `Delete ${u.username}?`,
      tone: 'danger',
      message:
        'The account is removed immediately along with its site permissions. Anything it created — log entries, uploaded backups — is kept.',
      confirmLabel: 'Delete user',
      requireText: u.username,
    });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`${u.username} deleted.`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'This account could not be deleted.');
    }
  }

  function toggleClient(id) {
    setForm((f) => ({
      ...f,
      clientIds: f.clientIds.includes(id) ? f.clientIds.filter((x) => x !== id) : [...f.clientIds, id],
    }));
  }

  function accessSummary(u) {
    if (u.role === 'ADMIN') return 'Every site';
    const n = u.clientIds?.length || 0;
    if (n === 0) return 'No sites yet';
    if (n === clients.length && clients.length > 0) return `All ${num(n)} sites`;
    return `${num(n)} of ${num(clients.length)} ${plural(clients.length, 'site', 'sites')}`;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Manage"
        title="Users"
        description="Accounts that can sign in to HA-Hub, and which sites each one is allowed to see."
        meta={
          users.length > 0 && (
            <span className="text-2xs tnum text-fg-faint">
              {num(users.length)} {plural(users.length, 'account', 'accounts')} ·{' '}
              {num(adminCount)} {plural(adminCount, 'administrator', 'administrators')}
            </span>
          )
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>
            Add user
          </Button>
        }
      />

      {users.length > 3 && (
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by username, email or role"
          resultCount={filtered.length}
          totalCount={users.length}
          className="max-w-sm"
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No users yet"
            description="Add an account so someone else can sign in. Standard accounts only see the sites you assign to them."
            action={<Button variant="primary" icon={Plus} onClick={() => openEditor(null)}>Add a user</Button>}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            compact
            title="No accounts match that search"
            action={<Button variant="secondary" onClick={() => setQ('')}>Clear search</Button>}
          />
        )
      ) : (
        <>
          <TableWrap className="hidden md:block" label="HA-Hub user accounts">
            <Table>
              <THead>
                <TR>
                  <TH className="w-[32%]">Account</TH>
                  <TH>Role</TH>
                  <TH>Site access</TH>
                  <TH>Last signed in</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((u) => (
                  <TR key={u.id} interactive>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Avatar user={u} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-fg">{u.username}</span>
                            {u.id === me?.id && <Badge tone="brand" size="sm">You</Badge>}
                          </div>
                          <span className="block truncate text-2xs text-fg-faint">{u.email || 'No email'}</span>
                        </div>
                      </div>
                    </TD>
                    <TD><RoleBadge role={u.role} /></TD>
                    <TD className="text-2xs text-fg-muted">{accessSummary(u)}</TD>
                    <TD className="whitespace-nowrap font-mono text-2xs tnum text-fg-faint">
                      {u.lastLoginAt ? relTime(u.lastLoginAt) : 'Never'}
                    </TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-0.5">
                        <IconButton icon={Pencil} size="sm" label={`Edit ${u.username}`} onClick={() => openEditor(u)} />
                        {u.id !== me?.id && (
                          <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${u.username}`} onClick={() => remove(u)} />
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <div className="space-y-2 md:hidden">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-xl border border-line bg-panel p-3 shadow-e1">
                <div className="flex items-start gap-2.5">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-fg">{u.username}</span>
                      {u.id === me?.id && <Badge tone="brand" size="sm">You</Badge>}
                    </div>
                    <span className="block truncate text-2xs text-fg-faint">{u.email || 'No email'}</span>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                  <span className="text-2xs text-fg-muted">
                    {accessSummary(u)} · {u.lastLoginAt ? relTime(u.lastLoginAt) : 'never signed in'}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <IconButton icon={Pencil} size="sm" label={`Edit ${u.username}`} onClick={() => openEditor(u)} />
                    {u.id !== me?.id && (
                      <IconButton icon={Trash2} size="sm" variant="danger" label={`Delete ${u.username}`} onClick={() => remove(u)} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Editor ───────────────────────────────────────────────────── */}
      {editing && (
        <Modal
          open
          size="md"
          icon={editingUser ? Pencil : Plus}
          title={editingUser ? `Edit ${editingUser.username}` : 'Add a user'}
          description={
            editingUser
              ? 'Leave the password blank to keep the current one.'
              : 'The account can sign in as soon as it is created.'
          }
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" form="user-form" type="submit" loading={saving}>
                {editingUser ? 'Save changes' : 'Create user'}
              </Button>
            </>
          }
        >
          <form id="user-form" onSubmit={save} className="space-y-4">
            {err && <Alert tone="error">{err}</Alert>}

            <FieldRow>
              <Field label="Username" required hint={editingUser ? 'Usernames cannot be changed.' : undefined}>
                {(a) => (
                  <Input
                    {...a}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="off"
                    disabled={!!editingUser}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Role" required>
                {(a) => (
                  <Select {...a} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="USER">Standard</option>
                    <option value="ADMIN">Administrator</option>
                  </Select>
                )}
              </Field>
            </FieldRow>

            {/* State the consequence of the role at the moment it is chosen. */}
            <Alert tone={form.role === 'ADMIN' ? 'warning' : 'info'} icon={form.role === 'ADMIN' ? ShieldCheck : UserIcon}>
              {form.role === 'ADMIN'
                ? 'Administrators see every site and can add, edit and delete sites, users and backups, and run system updates.'
                : 'Standard accounts can only view the sites you tick below. They cannot manage sites, users or system settings.'}
            </Alert>

            <Field label="Email" labelSuffix="— optional" hint="Only used to identify the account; HA-Hub does not send mail.">
              {(a) => (
                <Input {...a} type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              )}
            </Field>

            <Field
              label={editingUser ? 'New password' : 'Password'}
              required={!editingUser}
              hint="At least 8 characters."
            >
              {(a) => (
                <PasswordInput
                  {...a}
                  required={!editingUser}
                  minLength={editingUser ? 0 : 8}
                  autoComplete="new-password"
                  placeholder={editingUser ? 'Leave blank to keep the current password' : ''}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              )}
            </Field>

            {form.role === 'USER' && (
              <Field
                label="Site access"
                hint={
                  form.clientIds.length === 0
                    ? 'With nothing ticked this account signs in to an empty fleet.'
                    : `${num(form.clientIds.length)} of ${num(clients.length)} ${plural(clients.length, 'site', 'sites')} selected.`
                }
              >
                <div className="overflow-hidden rounded-lg border border-line bg-ink/50">
                  {clients.length > 0 && (
                    <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
                      <span className="text-2xs text-fg-faint">
                        {num(form.clientIds.length)} selected
                      </span>
                      <div className="flex gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setForm((f) => ({ ...f, clientIds: clients.map((c) => c.id) }))}
                        >
                          Select all
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={form.clientIds.length === 0}
                          onClick={() => setForm((f) => ({ ...f, clientIds: [] }))}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="max-h-56 overflow-y-auto p-1">
                    {clients.map((c) => (
                      <Checkbox
                        key={c.id}
                        label={c.name}
                        description={c.url}
                        checked={form.clientIds.includes(c.id)}
                        onChange={() => toggleClient(c.id)}
                      />
                    ))}
                    {clients.length === 0 && (
                      <p className="px-2 py-3 text-sm text-fg-faint">
                        No sites are registered yet, so there is nothing to assign.
                      </p>
                    )}
                  </div>
                </div>
              </Field>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

function Avatar({ user }) {
  const isAdmin = user.role === 'ADMIN';
  return (
    <span
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-display text-2xs font-semibold',
        isAdmin ? 'border-warn/30 bg-warn/10 text-warn' : 'border-line bg-raised text-fg-muted'
      )}
      aria-hidden="true"
    >
      {user.username.slice(0, 2).toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }) {
  return role === 'ADMIN' ? (
    <Badge tone="warn" icon={ShieldCheck}>Administrator</Badge>
  ) : (
    <Badge tone="neutral" icon={UserIcon}>Standard</Badge>
  );
}
