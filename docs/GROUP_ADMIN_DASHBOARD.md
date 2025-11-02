# Group Admin Dashboard

## Overview

Group administrators and moderators need tools to manage their groups without accessing the platform-wide admin dashboard. This scoped dashboard provides moderation and management capabilities restricted to their specific group.

## Access Control

### Roles
- **Owner**: Full permissions (created the group)
- **Admin**: Can moderate content, manage members
- **Moderator**: Can moderate content only
- **Member**: Regular access, no admin features

### Permission Matrix

| Action | Owner | Admin | Moderator | Member |
|--------|-------|-------|-----------|--------|
| Edit group details | ✅ | ✅ | ❌ | ❌ |
| Delete group | ✅ | ❌ | ❌ | ❌ |
| Promote/demote members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Approve/reject posts | ✅ | ✅ | ✅ | ❌ |
| Delete posts | ✅ | ✅ | ✅ | ❌ |
| View member list | ✅ | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ❌ | ❌ |

## Database Queries

Group admin dashboard queries are scoped to the group:

```javascript
// Posts in this group
query(
  collection(db, 'groups', groupId, 'posts'),
  orderBy('createdAt', 'desc')
)

// Members in this group
query(
  collection(db, 'groups', groupId, 'members'),
  orderBy('joinedAt', 'desc')
)

// Reported content in this group
query(
  collection(db, 'reports'),
  where('meta.groupId', '==', groupId)
)
```

## Implementation

### File Structure
```
src/
  pages/
    group/
      GroupAdminDashboard.jsx    // Main dashboard
  components/
    GroupModeration.jsx          // Content moderation
    GroupMemberManagement.jsx    // Member controls
    GroupAnalytics.jsx           // Stats & charts
```

### GroupAdminDashboard.jsx

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getMember } from '../../utils/groups';
import Layout from '../../components/Layout';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Article as ArticleIcon,
  Flag as FlagIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

export default function GroupAdminDashboard() {
  const { groupId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [group, setGroup] = useState(null);
  const [memberRole, setMemberRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPosts: 0,
    pendingPosts: 0,
    reports: 0
  });

  useEffect(() => {
    checkAccess();
  }, [groupId, currentUser]);

  const checkAccess = async () => {
    if (!currentUser) {
      navigate(`/group/${groupId}`);
      return;
    }

    try {
      // Fetch group
      const groupSnap = await getDoc(doc(db, 'groups', groupId));
      if (!groupSnap.exists()) {
        alert('Group not found');
        navigate('/groups');
        return;
      }
      const groupData = { id: groupSnap.id, ...groupSnap.data() };
      setGroup(groupData);

      // Check member role
      const member = await getMember(groupId, currentUser.uid);
      if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
        alert('You do not have admin access to this group');
        navigate(`/group/${groupId}`);
        return;
      }
      setMemberRole(member.role);

      // Fetch stats
      await fetchStats();
    } catch (error) {
      console.error('Failed to check access:', error);
      navigate(`/group/${groupId}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [membersSnap, postsSnap, reportsSnap] = await Promise.all([
        getDocs(collection(db, 'groups', groupId, 'members')),
        getDocs(collection(db, 'groups', groupId, 'posts')),
        getDocs(query(
          collection(db, 'reports'),
          where('meta.groupId', '==', groupId),
          where('status', '==', 'open')
        ))
      ]);

      const posts = postsSnap.docs.map(d => d.data());
      const pendingPosts = posts.filter(p => p.status === 'pending').length;

      setStats({
        totalMembers: membersSnap.size,
        totalPosts: postsSnap.size,
        pendingPosts,
        reports: reportsSnap.size
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const canManageMembers = memberRole === 'owner' || memberRole === 'admin';
  const canViewAnalytics = memberRole === 'owner' || memberRole === 'admin';

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-4">
          <p className="text-themed-secondary">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-themed mb-2">
            {group.name} - Admin Dashboard
          </h1>
          <p className="text-themed-muted">
            Your role: <span className="font-semibold capitalize">{memberRole}</span>
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: 'overview', label: 'Overview', icon: DashboardIcon },
            { key: 'posts', label: 'Posts', icon: ArticleIcon },
            { key: 'members', label: 'Members', icon: PeopleIcon, disabled: !canManageMembers },
            { key: 'reports', label: 'Reports', icon: FlagIcon },
            { key: 'analytics', label: 'Analytics', icon: AssessmentIcon, disabled: !canViewAnalytics }
          ].filter(t => !t.disabled).map(({ key, label, icon: IconComp }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                tab === key ? 'pill-active' : 'pill'
              }`}
            >
              <IconComp fontSize="small" />
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-themed-muted">Total Members</p>
                  <p className="text-3xl font-bold text-themed">{stats.totalMembers}</p>
                </div>
                <PeopleIcon className="text-blue-500" style={{ fontSize: 40 }} />
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-themed-muted">Total Posts</p>
                  <p className="text-3xl font-bold text-themed">{stats.totalPosts}</p>
                </div>
                <ArticleIcon className="text-green-500" style={{ fontSize: 40 }} />
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-themed-muted">Pending Approval</p>
                  <p className="text-3xl font-bold text-themed">{stats.pendingPosts}</p>
                </div>
                <ArticleIcon className="text-orange-500" style={{ fontSize: 40 }} />
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-themed-muted">Open Reports</p>
                  <p className="text-3xl font-bold text-themed">{stats.reports}</p>
                </div>
                <FlagIcon className="text-red-500" style={{ fontSize: 40 }} />
              </div>
            </div>
          </div>
        )}

        {/* Other tabs: Posts, Members, Reports, Analytics */}
        {/* Implement as separate components for modularity */}
      </div>
    </Layout>
  );
}
```

## Security Considerations

1. **No Cross-Group Access**: All queries must filter by `groupId`
2. **Role Verification**: Check member role on every action
3. **Audit Logs**: Track admin actions for accountability
4. **Rate Limiting**: Prevent abuse of moderation powers

## Firestore Rules

```javascript
match /groups/{groupId}/posts/{postId} {
  // Group admins/mods can approve/reject/delete
  allow update, delete: if isSignedIn() && isGroupAdminOrMod(groupId);
}

match /groups/{groupId}/members/{memberId} {
  // Group admins can update member roles
  allow update: if isSignedIn() && isGroupAdmin(groupId);
  allow delete: if isSignedIn() && (
    isGroupAdmin(groupId) || 
    request.auth.uid == memberId  // Members can leave
  );
}
```

## UI Patterns

### Quick Actions Panel
```jsx
<div className="card p-6 mb-6">
  <h3 className="font-semibold text-themed mb-4">Quick Actions</h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <button className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50">
      Approve Posts
    </button>
    <button className="p-4 border-2 border-red-500 rounded-lg hover:bg-red-50">
      Review Reports
    </button>
    {/* ... more actions ... */}
  </div>
</div>
```

### Member Management Table
- Search/filter members
- Bulk actions (promote, remove)
- Export member list
- Send group announcements

### Content Moderation Queue
- Pending posts list
- Quick approve/reject buttons
- Preview post content
- Reason for rejection (optional note to author)

## Mobile Optimization

- Collapsible sections
- Swipe actions for quick moderation
- Responsive data tables
- Bottom sheet for member details

## Future Enhancements

1. **Scheduled Posts**: Allow group admins to schedule content
2. **Auto-Moderation**: AI-powered spam detection
3. **Custom Rules**: Define group-specific posting guidelines
4. **Member Tiers**: VIP/Regular member badges
5. **Activity Logs**: View all admin actions history
6. **Announcements**: Pin important messages
7. **Group Events**: Calendar integration for group activities
