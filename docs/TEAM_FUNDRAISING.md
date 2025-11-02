# Team Fundraising System

## Overview

Team Fundraising allows multiple users to join a single campaign as a "Team." The campaign page displays a team leaderboard showing which member has raised the most funds, creating friendly competition and collaboration.

## Database Structure

### Campaign Document (posts collection)
```javascript
{
  // ... existing fields ...
  teamEnabled: boolean,           // Is this a team campaign?
  teamMembers: [                  // Array of team member objects
    {
      userId: string,
      displayName: string,
      photoURL: string,
      joinedAt: timestamp,
      role: 'leader' | 'member',  // Campaign creator is the leader
      raised: number               // Individual contribution
    }
  ],
  teamGoal: number,                // Optional: separate team goal
  teamDescription: string          // Optional: team story
}
```

### Transactions Extension
```javascript
{
  // ... existing fields ...
  campaignId: string,
  teamMemberId: string,    // Which team member gets credit
  attributedTo: string     // Display name for leaderboard
}
```

## Implementation Steps

### Step 1: Campaign Creation - Team Option

Add team toggle in `CreateCampaign.jsx`:

```jsx
const [teamEnabled, setTeamEnabled] = useState(false);
const [teamDescription, setTeamDescription] = useState('');

// In the form
<div className="space-y-2">
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={teamEnabled}
      onChange={(e) => setTeamEnabled(e.target.checked)}
    />
    <span className="font-medium text-themed">Enable Team Fundraising</span>
  </label>
  {teamEnabled && (
    <div>
      <label className="block text-sm text-themed-muted mb-1">
        Team Description (optional)
      </label>
      <textarea
        value={teamDescription}
        onChange={(e) => setTeamDescription(e.target.value)}
        className="input-field"
        placeholder="Describe your team and how you'll work together..."
        rows={3}
      />
    </div>
  )}
</div>

// When creating campaign
await addDoc(collection(db, 'posts'), {
  // ... existing fields ...
  teamEnabled,
  teamDescription: teamDescription || '',
  teamMembers: teamEnabled ? [{
    userId: currentUser.uid,
    displayName: userProfile?.displayName || currentUser.displayName,
    photoURL: currentUser.photoURL || '',
    joinedAt: serverTimestamp(),
    role: 'leader',
    raised: 0
  }] : []
});
```

### Step 2: Join Team Component

Create `src/components/JoinTeamButton.jsx`:

```jsx
import { useState } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import GroupAddIcon from '@mui/icons-material/GroupAdd';

export const JoinTeamButton = ({ campaign, onSuccess }) => {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const isAlreadyMember = campaign.teamMembers?.some(
    m => m.userId === currentUser?.uid
  );
  
  const handleJoinTeam = async () => {
    if (!currentUser) {
      alert('Please log in to join this team');
      return;
    }
    
    if (isAlreadyMember) {
      alert('You are already a team member');
      return;
    }
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'posts', campaign.id), {
        teamMembers: arrayUnion({
          userId: currentUser.uid,
          displayName: userProfile?.displayName || currentUser.displayName || 'Team Member',
          photoURL: currentUser.photoURL || '',
          joinedAt: serverTimestamp(),
          role: 'member',
          raised: 0
        })
      });
      
      alert('Successfully joined the team!');
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Failed to join team:', error);
      alert('Failed to join team. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!campaign.teamEnabled) return null;
  if (isAlreadyMember) return null;
  
  return (
    <button
      onClick={handleJoinTeam}
      disabled={loading}
      className="btn-primary flex items-center gap-2"
    >
      <GroupAddIcon fontSize="small" />
      {loading ? 'Joining...' : 'Join This Team'}
    </button>
  );
};
```

### Step 3: Team Leaderboard Component

Create `src/components/TeamLeaderboard.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatCurrencyShort } from '../utils/numberFormat';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PersonIcon from '@mui/icons-material/Person';

export const TeamLeaderboard = ({ campaign }) => {
  const [teamStats, setTeamStats] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTeamStats();
  }, [campaign.id]);
  
  const fetchTeamStats = async () => {
    if (!campaign.teamMembers || campaign.teamMembers.length === 0) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch donations for this campaign
      const txQuery = query(
        collection(db, 'transactions'),
        where('campaignId', '==', campaign.id),
        where('type', '==', 'donation')
      );
      const txSnap = await getDocs(txQuery);
      
      // Calculate raised amount per team member
      const memberTotals = {};
      txSnap.docs.forEach(doc => {
        const data = doc.data();
        const memberId = data.teamMemberId || data.donorId;
        if (memberId) {
          memberTotals[memberId] = (memberTotals[memberId] || 0) + (data.amount || 0);
        }
      });
      
      // Build leaderboard with team member info
      const leaderboard = campaign.teamMembers.map(member => ({
        ...member,
        raised: memberTotals[member.userId] || 0
      })).sort((a, b) => b.raised - a.raised);
      
      setTeamStats(leaderboard);
    } catch (error) {
      console.error('Failed to fetch team stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (!campaign.teamEnabled || !campaign.teamMembers?.length) {
    return null;
  }
  
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <EmojiEventsIcon className="text-yellow-500" style={{ fontSize: 28 }} />
        <h3 className="text-xl font-bold text-themed">Team Leaderboard</h3>
      </div>
      
      {campaign.teamDescription && (
        <p className="text-sm text-themed-muted mb-4">{campaign.teamDescription}</p>
      )}
      
      {loading ? (
        <p className="text-themed-secondary text-sm">Loading team stats...</p>
      ) : (
        <div className="space-y-3">
          {teamStats.map((member, index) => (
            <div
              key={member.userId}
              className={`p-4 rounded-lg border ${
                index === 0
                  ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-outline-variant'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {index === 0 && (
                      <div className="absolute -top-2 -left-2">
                        <EmojiEventsIcon className="text-yellow-500" fontSize="small" />
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {member.photoURL ? (
                        <img
                          src={member.photoURL}
                          alt={member.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <PersonIcon />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-themed">{member.displayName}</p>
                      {member.role === 'leader' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-themed-muted">
                      Joined {new Date(member.joinedAt?.toDate?.() || member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrencyShort(member.raised)}
                  </p>
                  <p className="text-xs text-themed-muted">raised</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-themed">Team Total</span>
          <span className="text-lg font-bold text-green-600">
            {formatCurrencyShort(teamStats.reduce((sum, m) => sum + m.raised, 0))}
          </span>
        </div>
      </div>
    </div>
  );
};
```

### Step 4: Update CampaignDetail.jsx

Add team components to campaign detail page:

```jsx
import { JoinTeamButton } from '../../components/JoinTeamButton';
import { TeamLeaderboard } from '../../components/TeamLeaderboard';

// In the JSX, before or after donation section
{post.teamEnabled && (
  <>
    <TeamLeaderboard campaign={post} />
    <JoinTeamButton campaign={post} onSuccess={() => fetchPost()} />
  </>
)}
```

### Step 5: Attribution During Donation

Update donation logic to attribute to team member:

```jsx
// In CampaignDetail.jsx donation handler
const handleDonate = async (e) => {
  e.preventDefault();
  // ... existing validation ...
  
  // If team campaign, ask which member to attribute to
  let teamMemberId = currentUser.uid;
  let attributedTo = userProfile?.displayName || currentUser.displayName;
  
  if (post.teamEnabled && post.teamMembers?.length > 1) {
    // Show modal or dropdown to select team member
    const selectedMember = await selectTeamMember(post.teamMembers);
    if (selectedMember) {
      teamMemberId = selectedMember.userId;
      attributedTo = selectedMember.displayName;
    }
  }
  
  // In transaction
  await runTransaction(db, async (transaction) => {
    // ... existing transaction logic ...
    
    const txRef = doc(collection(db, 'transactions'));
    transaction.set(txRef, {
      // ... existing fields ...
      teamMemberId,
      attributedTo,
      isTeamDonation: post.teamEnabled || false
    });
  });
};
```

## Security Rules Update

Add to `FIRESTORE_RULES.md`:

```javascript
// Campaign posts with teams
match /posts/{postId} {
  // ... existing rules ...
  
  // Allow team members to update only their own stats
  allow update: if isSignedIn() &&
    request.resource.data.diff(resource.data).changedKeys().hasOnly(['teamMembers']) &&
    // Verify user is adding themselves
    request.auth.uid in request.resource.data.teamMembers.map(m => m.userId);
}
```

## UI/UX Enhancements

### Team Badge on Campaign Cards

In `PostCard.jsx`:

```jsx
{post.teamEnabled && (
  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
    <GroupIcon fontSize="small" />
    <span>Team Campaign • {post.teamMembers?.length || 0} members</span>
  </div>
)}
```

### Team Member Profile Links

Make team member names clickable to view their profiles.

### Team Progress Visualization

Show a stacked progress bar with different colors for each team member's contribution.

## Testing Checklist

- [ ] Create team-enabled campaign
- [ ] Non-creator can join team
- [ ] Leaderboard updates after donations
- [ ] Team members can't join twice
- [ ] Leaderboard sorts correctly
- [ ] Team total matches campaign total
- [ ] Mobile responsive layout

## Future Enhancements

1. **Team Invitations**: Campaign creator can invite specific users
2. **Team Roles**: Add coordinators with limited management rights
3. **Team Chat**: Built-in messaging for team members
4. **Sub-goals**: Each team member can set personal goals
5. **Team Badges**: Unlock achievements as a team
6. **Social Sharing**: Auto-generate team progress images for social media
7. **Team Competitions**: Platform-wide leaderboards across campaigns

## Analytics

Track team campaign performance:
- Average team size
- Conversion rate: viewers → team members
- Team vs solo campaign success rates
- Most active team members
