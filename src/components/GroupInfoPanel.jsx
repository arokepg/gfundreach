import { useEffect, useMemo, useState } from 'react';
import { X, Shield, UserRound, Check, XCircle, Upload, Users, Image as ImageIcon, Link as LinkIcon, Music2 } from 'lucide-react';
import CampaignContextCard from './CampaignContextCard';
import { approveInvite, getSharedMedia, inviteMember, rejectInvite, setGroupRole, updateGroupSettings, getConversation } from '../utils/messaging';
import { useAuth } from '../contexts/AuthContext';

/**
 * GroupInfoPanel - right-side drawer for managing a group conversation
 * Props:
 *  - conversationId: string
 *  - open: boolean
 *  - onClose: () => void
 */
const GroupInfoPanel = ({ conversationId, open, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conv, setConv] = useState(null);
  const [tab, setTab] = useState('overview'); // overview | shared
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [invitePermission, setInvitePermission] = useState('approval');
  const [inviteId, setInviteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState({ images: [], audios: [], campaigns: [], links: [] });

  const isAdmin = useMemo(() => conv?.roles?.[currentUser?.uid] === 'admin', [conv, currentUser?.uid]);

  useEffect(() => {
    if (!open || !conversationId) return;
    (async () => {
      setLoading(true);
      try {
        const c = await getConversation(conversationId);
        setConv(c);
        const settings = c?.settings || {};
        setName(settings.name || c?.groupName || 'Group Chat');
        setImageUrl(settings.groupImageUrl || '');
        setInvitePermission(settings.invitePermission || 'approval');
        const m = await getSharedMedia(conversationId, 200);
        setMedia(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, conversationId]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateGroupSettings(conversationId, currentUser.uid, {
        name,
        groupImageUrl: imageUrl,
        invitePermission,
      });
      // update local immediately
      setConv(prev => ({ ...prev, settings: { ...(prev?.settings || {}), name, groupImageUrl: imageUrl, invitePermission } }));
    } catch (e) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteId.trim()) return;
    try {
      const res = await inviteMember(conversationId, currentUser.uid, inviteId.trim());
      if (res.status === 'joined') {
        setConv(prev => ({ ...prev, participants: [...(prev.participants || []), inviteId.trim()] }));
      } else if (res.status === 'pending') {
        setConv(prev => ({ ...prev, pendingInvites: { ...(prev.pendingInvites || {}), [inviteId.trim()]: { invitedBy: currentUser.uid, invitedAt: new Date() } } }));
      }
      setInviteId('');
    } catch (e) {
      alert(e.message || 'Invite failed');
    }
  };

  const handleApprove = async (uid) => {
    try {
      await approveInvite(conversationId, currentUser.uid, uid);
      setConv(prev => ({
        ...prev,
        participants: [...(prev.participants || []), uid],
        pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined },
      }));
    } catch (e) { alert(e.message || 'Approve failed'); }
  };

  const handleReject = async (uid) => {
    try {
      await rejectInvite(conversationId, currentUser.uid, uid);
      setConv(prev => ({ ...prev, pendingInvites: { ...(prev.pendingInvites || {}), [uid]: undefined } }));
    } catch (e) { alert(e.message || 'Reject failed'); }
  };

  const handleRole = async (uid, role) => {
    try {
      await setGroupRole(conversationId, currentUser.uid, uid, role);
      setConv(prev => ({ ...prev, roles: { ...(prev.roles || {}), [uid]: role } }));
    } catch (e) { alert(e.message || 'Change role failed'); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[380px] max-w-[90vw] bg-white dark:bg-gray-900 border-l border-themed-border shadow-xl flex flex-col">
        <div className="p-4 border-b border-themed-border flex items-center justify-between">
          <h3 className="font-semibold text-themed flex items-center gap-2"><Users size={18} /> Group Info</h3>
          <button className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-themed-muted">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Header info */}
            <div className="p-4 border-b border-themed-border flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {imageUrl ? (
                  <img src={imageUrl} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Users size={24} className="text-themed-muted" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-themed truncate">{conv?.settings?.name || conv?.groupName || 'Group Chat'}</div>
                <div className="text-xs text-themed-muted">{(conv?.participants || []).length} members</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="p-4 flex gap-2 border-b border-themed-border">
              <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='overview'?'bg-green-600 text-white':'bg-themed-secondary text-themed'}`} onClick={()=>setTab('overview')}>Overview</button>
              <button className={`px-3 py-1.5 rounded-lg text-sm ${tab==='shared'?'bg-green-600 text-white':'bg-themed-secondary text-themed'}`} onClick={()=>setTab('shared')}>Shared Media</button>
            </div>

            {tab === 'overview' ? (
              <div className="p-4 space-y-6">
                {/* Admin controls */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-themed">Group settings</div>
                  <div className="space-y-2">
                    <label className="block text-xs text-themed-muted">Name</label>
                    <input value={name} onChange={(e)=>setName(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded border border-themed-border bg-themed" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs text-themed-muted">Avatar URL</label>
                    <input value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded border border-themed-border bg-themed" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" disabled={!isAdmin} checked={invitePermission==='approval'} onChange={(e)=>setInvitePermission(e.target.checked?'approval':'auto')} />
                    <span className="text-sm text-themed">Require admin approval for invites</span>
                  </div>
                  {isAdmin && (
                    <button disabled={saving} onClick={handleSaveSettings} className="px-4 py-2 rounded bg-green-600 text-white text-sm disabled:opacity-50">{saving? 'Saving…':'Save settings'}</button>
                  )}
                </div>

                {/* Invite */}
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-themed">Invite member</div>
                  <div className="flex gap-2">
                    <input value={inviteId} onChange={(e)=>setInviteId(e.target.value)} placeholder="Enter user ID" className="flex-1 px-3 py-2 rounded border border-themed-border bg-themed" />
                    <button onClick={handleInvite} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Invite</button>
                  </div>
                  {conv?.pendingInvites && Object.keys(conv.pendingInvites).length>0 && (
                    <div className="mt-2 text-sm">
                      <div className="text-themed font-medium mb-2">Pending approvals</div>
                      <ul className="space-y-2">
                        {Object.keys(conv.pendingInvites).map(uid=> (
                          <li key={uid} className="flex items-center justify-between p-2 rounded border border-themed-border">
                            <div className="flex items-center gap-2"><UserRound size={16} /><span>{uid}</span></div>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <button onClick={()=>handleApprove(uid)} className="px-2 py-1 rounded bg-green-600 text-white text-xs flex items-center gap-1"><Check size={14}/>Approve</button>
                                <button onClick={()=>handleReject(uid)} className="px-2 py-1 rounded bg-red-600 text-white text-xs flex items-center gap-1"><XCircle size={14}/>Reject</button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-themed">Members</div>
                  <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                    {(conv?.participants || []).map(uid => {
                      const name = conv?.participantNames?.[uid] || uid;
                      const photo = conv?.participantPhotos?.[uid] || '';
                      const role = conv?.roles?.[uid] || 'member';
                      return (
                        <li key={uid} className="flex items-center justify-between p-2 rounded border border-themed-border">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              {photo ? <img src={photo} alt={name} className="w-full h-full object-cover"/> : <UserRound size={18} className="text-themed-muted"/>}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm text-themed truncate">{name}</div>
                              <div className="text-xs text-themed-muted flex items-center gap-1">{role==='admin'?<Shield size={12}/>:null}{role}</div>
                            </div>
                          </div>
                          {isAdmin && currentUser?.uid !== uid && (
                            <select className="text-sm border border-themed-border rounded px-2 py-1 bg-themed" value={role} onChange={(e)=>handleRole(uid, e.target.value)}>
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Images */}
                {media.images.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><ImageIcon size={16}/>Images</div>
                    <div className="grid grid-cols-3 gap-2">
                      {media.images.map(img => (
                        <img key={img.id} src={img.url} alt="shared" className="w-full h-24 object-cover rounded"/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio */}
                {media.audios.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><Music2 size={16}/>Audio</div>
                    <div className="space-y-2">
                      {media.audios.map(a => (
                        <audio key={a.id} controls src={a.url} className="w-full" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Campaigns */}
                {media.campaigns.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2">Campaigns</div>
                    <div className="space-y-3">
                      {media.campaigns.map(c => (
                        <CampaignContextCard key={c.id} campaign={c.campaign} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                {media.links.length>0 && (
                  <div>
                    <div className="text-sm font-semibold text-themed mb-2 flex items-center gap-2"><LinkIcon size={16}/>Links</div>
                    <ul className="space-y-1 text-sm">
                      {media.links.map(l => (
                        <li key={l.id}><a className="text-blue-600 hover:underline" href={l.url} target="_blank" rel="noreferrer">{l.url}</a></li>
                      ))}
                    </ul>
                  </div>
                )}

                {media.images.length===0 && media.audios.length===0 && media.campaigns.length===0 && media.links.length===0 && (
                  <div className="text-sm text-themed-muted">No shared media yet.</div>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export default GroupInfoPanel;
