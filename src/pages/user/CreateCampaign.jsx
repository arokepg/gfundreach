import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { createNotification } from '../../utils/notifications';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const CreateCampaign = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    shortSummary: '',
    category: 'Medical',
    goalAmount: '',
    locationCity: '',
    locationCountry: '',
    tagsCsv: '',
    deadline: '',
    videoUrl: '',
    beneficiaryName: '',
    beneficiaryRelation: '',
    visibility: 'public',
    minDonation: '',
    suggestedCsv: '10,25,50',
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const groupId = params.get('groupId');

  const categories = [
    'Medical',
    'Education',
    'Emergency',
    'Community',
    'Animal Welfare',
    'Environment',
    'Arts & Culture',
    'Other',
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.goalAmount) {
      setError('Please fill in all required fields');
      return;
    }

    if (parseFloat(formData.goalAmount) <= 0) {
      setError('Goal amount must be greater than 0');
      return;
    }

    try {
      setError('');
      setLoading(true);

      let imageUrl = '';
      
      // Upload image if provided
      if (image) {
        const imageRef = ref(storage, `posts/${currentUser.uid}/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(imageRef);
      }

      // Prepare derived fields
      const tags = (formData.tagsCsv || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      const tagsLower = tags.map(t => t.toLowerCase());
      const suggestedDonations = (formData.suggestedCsv || '')
        .split(',')
        .map(v => parseFloat(v.trim()))
        .filter(n => !isNaN(n) && n > 0);
      const deadlineISO = formData.deadline ? new Date(formData.deadline).toISOString() : null;

  // Create post document
      const docRef = await addDoc(collection(db, 'posts'), {
        title: formData.title,
        titleLower: (formData.title || '').toLowerCase().trim(),
        description: formData.description,
        shortSummary: formData.shortSummary?.slice(0, 160) || '',
        category: formData.category,
        goalAmount: parseFloat(formData.goalAmount),
        currentAmount: 0,
        imageUrl,
        authorId: currentUser.uid,
  authorName: currentUser.displayName || currentUser.email || 'Anonymous',
        authorPhoto: currentUser.photoURL || '',
        supporters: 0,
        // Campaign meta
        locationCity: formData.locationCity || '',
        locationCountry: formData.locationCountry || '',
        tags,
        tagsLower,
        deadline: deadlineISO,
        videoUrl: formData.videoUrl || '',
        beneficiary: {
          name: formData.beneficiaryName || '',
          relation: formData.beneficiaryRelation || '',
        },
        visibility: formData.visibility || 'public',
        minDonation: formData.minDonation ? parseFloat(formData.minDonation) : null,
        suggestedDonations,
        campaignStatus: 'active',
        updateCount: 0,
        lastUpdateAt: null,
        lastUpdatePreview: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Group campaign support
        groupId: groupId || null,
      });

      // Best-effort: if created inside a group, notify group members
      if (groupId) {
        try {
          const gSnap = await getDoc(doc(db, 'groups', groupId));
          const groupName = gSnap.data()?.name || 'Group';
          const membersSnap = await getDocs(collection(db, 'groups', groupId, 'members'));
          const recipients = membersSnap.docs
            .map(d => d.data())
            .filter(m => m.userId && m.userId !== currentUser.uid);
          await Promise.allSettled(
            recipients.map(m => createNotification(m.userId, 'group_campaign_created', {
              senderId: currentUser.uid,
              senderName: currentUser.displayName || 'Someone',
              groupId,
              groupName,
              campaignId: docRef.id,
            }))
          );
        } catch (e) {
          console.warn('Failed to notify group members (non-fatal):', e);
        }
      }

      // Redirect: if created inside a group, go to campaign detail; otherwise go home
      navigate(groupId ? `/post/${docRef.id}` : '/');
    } catch (err) {
      setError('Failed to create post: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 animate-fade-in">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-themed-secondary hover:text-themed mb-6 transition-colors animate-slide-in-up"
        >
          <ArrowBackIcon />
          <span>Back to Home</span>
        </button>

        <div className="card p-8 animate-slide-in-up">
          <h1 className="text-3xl font-bold text-themed mb-6">Create Campaign</h1>

          {error && (
            <div className="bg-error-50 border border-error text-error-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Campaign Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter campaign title"
                required
              />
            </div>

            {/* Short Summary */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Short Summary (max 160 chars)
              </label>
              <input
                type="text"
                name="shortSummary"
                value={formData.shortSummary}
                onChange={handleChange}
                className="input-field"
                placeholder="What is this campaign about?"
                maxLength={160}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input-field"
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Goal Amount */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Goal Amount (USD) *
              </label>
              <input
                type="number"
                name="goalAmount"
                value={formData.goalAmount}
                onChange={handleChange}
                className="input-field"
                placeholder="Enter goal amount"
                min="1"
                step="0.01"
                required
              />
            </div>

            {/* Minimum & Suggested Donations */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Minimum Donation</label>
                <input
                  type="number"
                  name="minDonation"
                  value={formData.minDonation}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., 5"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Suggested Donations (comma separated)</label>
                <input
                  type="text"
                  name="suggestedCsv"
                  value={formData.suggestedCsv}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="10,25,50"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field resize-none"
                rows="6"
                placeholder="Tell people about your campaign..."
                required
              />
            </div>

            {/* Location */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-themed mb-2">City</label>
                <input
                  type="text"
                  name="locationCity"
                  value={formData.locationCity}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., Jakarta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Country</label>
                <input
                  type="text"
                  name="locationCountry"
                  value={formData.locationCountry}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., Indonesia"
                />
              </div>
            </div>

            {/* Tags & Deadline */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Tags (comma separated)</label>
                <input
                  type="text"
                  name="tagsCsv"
                  value={formData.tagsCsv}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="medical,child,urgent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Deadline</label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">Video URL (YouTube)</label>
              <input
                type="url"
                name="videoUrl"
                value={formData.videoUrl}
                onChange={handleChange}
                className="input-field"
                placeholder="https://youtu.be/... or https://www.youtube.com/watch?v=..."
              />
            </div>

            {/* Beneficiary */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Beneficiary Name</label>
                <input
                  type="text"
                  name="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Who receives the funds?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-themed mb-2">Relation</label>
                <input
                  type="text"
                  name="beneficiaryRelation"
                  value={formData.beneficiaryRelation}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="e.g., Self, Family, Friend"
                />
              </div>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">Visibility</label>
              <select
                name="visibility"
                value={formData.visibility}
                onChange={handleChange}
                className="input-field"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-themed mb-2">
                Upload Image
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="imageUpload"
                />
                <label
                  htmlFor="imageUpload"
                  className="btn-secondary inline-flex items-center gap-2 cursor-pointer"
                >
                  <CloudUploadIcon />
                  Choose File
                </label>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-24 h-24 object-cover rounded-lg border"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Creating...' : 'Create Campaign'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CreateCampaign;
