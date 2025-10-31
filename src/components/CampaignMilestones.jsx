import { useState } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AddIcon from '@mui/icons-material/Add';
import { createNotification } from '../utils/notifications';

const CampaignMilestones = ({ campaign, isOwner, donors = [] }) => {
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [posting, setPosting] = useState(false);

  const milestones = [
    { percent: 25, label: '25% Funded', reached: campaign.raisedAmount >= campaign.goalAmount * 0.25 },
    { percent: 50, label: '50% Funded', reached: campaign.raisedAmount >= campaign.goalAmount * 0.50 },
    { percent: 75, label: '75% Funded', reached: campaign.raisedAmount >= campaign.goalAmount * 0.75 },
    { percent: 100, label: 'Goal Reached!', reached: campaign.raisedAmount >= campaign.goalAmount },
  ];

  const currentPercent = Math.min(100, Math.round((campaign.raisedAmount / campaign.goalAmount) * 100));
  const updates = campaign.updates || [];

  const handlePostUpdate = async () => {
    if (!updateText.trim() || !isOwner) return;

    try {
      setPosting(true);
      const update = {
        text: updateText.trim(),
        timestamp: new Date().toISOString(),
        author: campaign.authorName || 'Campaign Owner',
      };

      await updateDoc(doc(db, 'posts', campaign.id), {
        updates: arrayUnion(update),
        updatedAt: serverTimestamp(),
      });

      // Notify all donors about the update
      const donorNotifications = donors.map(donorId => 
        createNotification(donorId, 'campaign_update', {
          campaignId: campaign.id,
          campaignTitle: campaign.title,
          updateText: updateText.trim().substring(0, 100),
        }).catch(err => console.error('Failed to notify donor:', err))
      );

      await Promise.allSettled(donorNotifications);

      setUpdateText('');
      setShowAddUpdate(false);
      alert('Update posted successfully!');
    } catch (error) {
      console.error('Error posting update:', error);
      alert('Failed to post update. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Milestone Progress */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TimelineIcon className="text-green-600" />
          <h3 className="text-lg font-semibold text-themed">Campaign Milestones</h3>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-themed-secondary">Progress</span>
            <span className="text-sm font-semibold text-green-600">{currentPercent}%</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-linear-to-r from-green-500 to-emerald-600 transition-all duration-500 relative"
              style={{ width: `${currentPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Milestone List */}
        <div className="space-y-3">
          {milestones.map((milestone) => (
            <div 
              key={milestone.percent}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                milestone.reached 
                  ? 'bg-green-50 dark:bg-green-900/20' 
                  : 'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              {milestone.reached ? (
                <CheckCircleIcon className="text-green-600 dark:text-green-400" />
              ) : (
                <RadioButtonUncheckedIcon className="text-gray-400" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  milestone.reached 
                    ? 'text-green-700 dark:text-green-400' 
                    : 'text-themed-secondary'
                }`}>
                  {milestone.label}
                </p>
              </div>
              {milestone.reached && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                  Achieved
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Updates */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-themed">Campaign Updates</h3>
          {isOwner && (
            <button
              onClick={() => setShowAddUpdate(!showAddUpdate)}
              className="btn-outline flex items-center gap-2 text-sm"
            >
              <AddIcon fontSize="small" />
              Post Update
            </button>
          )}
        </div>

        {/* Add Update Form */}
        {showAddUpdate && isOwner && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="Share an update with your donors..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-themed focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows="4"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handlePostUpdate}
                disabled={!updateText.trim() || posting}
                className="btn-primary text-sm"
              >
                {posting ? 'Posting...' : 'Post Update'}
              </button>
              <button
                onClick={() => {
                  setShowAddUpdate(false);
                  setUpdateText('');
                }}
                className="btn-outline text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Updates Timeline */}
        <div className="space-y-4">
          {updates.length === 0 ? (
            <p className="text-center text-themed-secondary py-8">
              No updates posted yet.
              {isOwner && ' Be the first to share your progress!'}
            </p>
          ) : (
            updates.slice().reverse().map((update, index) => (
              <div 
                key={index}
                className="border-l-2 border-green-500 pl-4 py-2"
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium text-themed text-sm">{update.author}</p>
                  <span className="text-xs text-themed-secondary">
                    {new Date(update.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-themed-secondary">{update.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignMilestones;
