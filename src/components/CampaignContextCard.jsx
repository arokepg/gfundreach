import { useNavigate } from 'react-router-dom';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { formatCurrencyShort } from '../utils/numberFormat';

/**
 * CampaignContextCard - Displays a campaign preview card in chat messages
 * Used when users send messages from a campaign page
 */
const CampaignContextCard = ({ campaign, compact = false }) => {
  const navigate = useNavigate();

  if (!campaign) {
    console.warn('CampaignContextCard: campaign is null or undefined');
    return null;
  }

  // Safe defaults
  const safeGoalAmount = typeof campaign.goalAmount === 'number' ? campaign.goalAmount : 0;
  const safeCurrentAmount = typeof campaign.currentAmount === 'number' ? campaign.currentAmount : 0;
  const safeSupporters = typeof campaign.supporters === 'number' ? campaign.supporters : 0;
  const safeTitle = campaign.title || 'Untitled Campaign';
  
  const progress = safeGoalAmount > 0 
    ? Math.min((safeCurrentAmount / safeGoalAmount) * 100, 100) 
    : 0;

  const handleClick = (e) => {
    e.preventDefault();
    if (campaign.id) {
      navigate(`/post/${campaign.id}`);
    }
  };

  if (compact) {
    return (
      <div 
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors max-w-md"
      >
        <TrendingUp size={16} className="text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-themed truncate">{safeTitle}</p>
          <p className="text-xs text-themed-secondary truncate">
            {formatCurrencyShort(safeCurrentAmount)} / {formatCurrencyShort(safeGoalAmount)} • {progress.toFixed(0)}%
          </p>
        </div>
        <ExternalLink size={14} className="text-themed-muted shrink-0" />
      </div>
    );
  }

  return (
    <div 
      onClick={handleClick}
      className="bg-themed-secondary border border-themed-border rounded-xl overflow-hidden cursor-pointer hover:border-green-500 transition-all max-w-md"
    >
      {/* Campaign Image */}
      {campaign.imageUrl && (
        <div className="relative h-32 bg-gray-200 dark:bg-gray-700">
          <img 
            src={campaign.imageUrl} 
            alt={safeTitle}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-full">
              {campaign.category || 'Campaign'}
            </span>
          </div>
        </div>
      )}
      
      {/* Campaign Info */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-themed line-clamp-2">{safeTitle}</h4>
          <ExternalLink size={16} className="text-themed-muted shrink-0 mt-1" />
        </div>
        
        {campaign.description && (
          <p className="text-sm text-themed-secondary line-clamp-2">
            {campaign.description}
          </p>
        )}
        
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-green-600">
              {formatCurrencyShort(safeCurrentAmount)}
            </span>
            <span className="text-themed-secondary">
              of {formatCurrencyShort(safeGoalAmount)}
            </span>
          </div>
          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-themed-muted">
            {progress.toFixed(1)}% funded • {safeSupporters} supporters
          </p>
        </div>
      </div>
    </div>
  );
};

export default CampaignContextCard;
