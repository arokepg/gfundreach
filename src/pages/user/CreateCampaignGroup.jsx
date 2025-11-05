import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { createGroupConversation } from '../../utils/messaging';
import Layout from '../../components/Layout';
import { default as ArrowLeft } from '@mui/icons-material/ArrowBack';
import { default as Users } from '@mui/icons-material/Group';
import { default as MessageCircle } from '@mui/icons-material/ChatBubbleOutlineOutlined';
import { default as CheckCircle } from '@mui/icons-material/CheckCircle';
import { default as Loader2 } from '@mui/icons-material/Autorenew';

/**
 * CreateCampaignGroup - Allow campaign owner to create a group chat with donors/supporters
 */
const CreateCampaignGroup = () => {
  const { campaignId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [campaign, setCampaign] = useState(null);
  const [donors, setDonors] = useState([]);
  const [selectedDonors, setSelectedDonors] = useState([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    fetchCampaignAndDonors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const fetchCampaignAndDonors = async () => {
    try {
      // Fetch campaign
      const campaignDoc = await getDoc(doc(db, 'posts', campaignId));
      if (!campaignDoc.exists()) {
        alert('Campaign not found');
        navigate('/profile');
        return;
      }

      const campaignData = { id: campaignDoc.id, ...campaignDoc.data() };
      
      // Check ownership
      if (campaignData.authorId !== currentUser?.uid) {
        alert('You do not have permission to manage this campaign');
        navigate('/profile');
        return;
      }

      setCampaign(campaignData);
      setGroupName(`${campaignData.title} - Supporters Group`);

      // Fetch donors from transactions
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('postId', '==', campaignId),
        where('type', '==', 'donation')
      );
      const transactionsSnap = await getDocs(transactionsQuery);
      
      // Extract unique donors with their info
      const donorMap = new Map();
      transactionsSnap.docs.forEach(txDoc => {
        const tx = txDoc.data();
        const donorId = tx.donorId || tx.senderId;
        if (donorId && donorId !== currentUser.uid) {
          if (!donorMap.has(donorId)) {
            donorMap.set(donorId, {
              id: donorId,
              name: tx.donorName || tx.senderName || 'Anonymous',
              photo: tx.donorPhoto || '',
              totalDonated: 0,
              donationCount: 0
            });
          }
          const donor = donorMap.get(donorId);
          donor.totalDonated += (tx.amount || 0);
          donor.donationCount += 1;
        }
      });

      const donorsList = Array.from(donorMap.values()).sort((a, b) => b.totalDonated - a.totalDonated);
      setDonors(donorsList);
      
      // Auto-select all by default
      setSelectedDonors(donorsList.map(d => d.id));
    } catch (err) {
      console.error('Error fetching campaign/donors:', err);
      alert('Failed to load campaign data');
      navigate('/profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleDonor = (donorId) => {
    setSelectedDonors(prev => 
      prev.includes(donorId) 
        ? prev.filter(id => id !== donorId)
        : [...prev, donorId]
    );
  };

  const handleCreateGroup = async () => {
    if (selectedDonors.length === 0) {
      alert('Please select at least one donor to add to the group');
      return;
    }

    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      const participantData = donors.filter(d => selectedDonors.includes(d.id));
      
      const groupId = await createGroupConversation(
        currentUser.uid,
        currentUser.displayName || 'Campaign Owner',
        selectedDonors,
        participantData,
        groupName.trim(),
        {
          type: 'campaign',
          campaignId: campaign.id,
          campaignTitle: campaign.title
        }
      );

      // Navigate to the group chat
      navigate(`/messages/${groupId}`);
    } catch (err) {
      console.error('Error creating group:', err);
      alert('Failed to create group: ' + (err.message || 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="card p-8 text-center">
            <p className="text-themed-secondary">Campaign not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 animate-fade-in">
        <button
          onClick={() => navigate(`/post/${campaignId}`)}
          className="flex items-center gap-2 text-themed-secondary hover:text-themed mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Campaign</span>
        </button>

        <div className="card p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users size={28} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-themed">Create Donor Group</h1>
              <p className="text-sm text-themed-secondary">{campaign.title}</p>
            </div>
          </div>

          {/* Group Name Input */}
          <div>
            <label className="block text-sm font-medium text-themed mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-themed border border-themed-border text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600"
              placeholder="Enter group name..."
            />
          </div>

          {/* Donor Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-themed">
                Select Donors ({selectedDonors.length} of {donors.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDonors(donors.map(d => d.id))}
                  className="text-sm text-green-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-themed-muted">|</span>
                <button
                  onClick={() => setSelectedDonors([])}
                  className="text-sm text-green-600 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {donors.length === 0 ? (
              <div className="text-center py-8 text-themed-secondary">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>No donors yet for this campaign</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {donors.map((donor) => {
                  const isSelected = selectedDonors.includes(donor.id);
                  return (
                    <div
                      key={donor.id}
                      onClick={() => toggleDonor(donor.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                          : 'bg-themed-secondary border-themed-border hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {donor.photo ? (
                          <img
                            src={donor.photo}
                            alt={donor.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                            {donor.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-themed">{donor.name}</p>
                          <p className="text-sm text-themed-secondary">
                            {formatCurrency(donor.totalDonated)} • {donor.donationCount} donation{donor.donationCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle size={24} className="text-green-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create Button */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/post/${campaignId}`)}
              className="flex-1 btn-secondary"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={creating || selectedDonors.length === 0 || !groupName.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MessageCircle size={20} />
                  Create Group Chat
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateCampaignGroup;
