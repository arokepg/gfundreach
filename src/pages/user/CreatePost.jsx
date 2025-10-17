import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const CreatePost = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Medical',
    goalAmount: '',
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

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

      // Create post document
      await addDoc(collection(db, 'posts'), {
        title: formData.title,
        titleLower: (formData.title || '').toLowerCase().trim(),
        description: formData.description,
        category: formData.category,
        goalAmount: parseFloat(formData.goalAmount),
        currentAmount: 0,
        imageUrl,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorPhoto: currentUser.photoURL || '',
        supporters: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      navigate('/');
    } catch (err) {
      setError('Failed to create post: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-primary hover:underline mb-4"
          >
            <ArrowBackIcon fontSize="small" />
            Back to Home
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Fundraising Post
          </h1>
          <p className="text-gray-600">
            Share your story and start raising funds
          </p>
        </div>

        {/* Form */}
        <div className="card p-8">
          {error && (
            <div className="bg-error-50 border border-error text-error-700 px-4 py-3 rounded-xl mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., Help Sarah Fight Cancer"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fundraising Goal (USD) *
              </label>
              <input
                type="number"
                name="goalAmount"
                value={formData.goalAmount}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., 5000"
                min="1"
                step="0.01"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field min-h-[200px] resize-y"
                placeholder="Tell your story... What are you raising funds for? Why is it important? How will the funds be used?"
                required
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="flex items-center gap-4">
              <button type="submit" className="btn-primary">
                {loading ? 'Creating...' : 'Create Post'}
              </button>
              {error && <span className="text-red-600 text-sm">{error}</span>}
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CreatePost;
