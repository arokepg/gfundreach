import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { uploadImage } from '../../utils/uploadHelpers';

const EditProfile = () => {
  const navigate = useNavigate();
  const { currentUser, fetchUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    age: '',
    gender: '',
    location: '',
    phone: '',
    bio: '',
    website: '',
  });

  useEffect(() => {
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchProfileData = async () => {
    try {
      if (!currentUser?.uid) {
        navigate('/login');
        return;
      }

      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          title: data.title || '',
          age: data.age || '',
          gender: data.gender || '',
          location: data.location || '',
          phone: data.phone || '',
          bio: data.bio || '',
          website: data.website || '',
        });
        // Set current profile picture as preview
        if (data.photoURL) {
          setProfilePicturePreview(data.photoURL);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      alert('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }
    
    setProfilePicture(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        title: formData.title,
        age: formData.age,
        gender: formData.gender,
        location: formData.location,
        phone: formData.phone,
        bio: formData.bio,
        website: formData.website,
        updatedAt: new Date(),
      };

      // Upload profile picture if a new one is selected
      if (profilePicture) {
        setUploadingPicture(true);
        try {
          const photoURL = await uploadImage(profilePicture, `profile-pictures/${currentUser.uid}`);
          updateData.photoURL = photoURL;
        } catch (uploadError) {
          console.error('Error uploading profile picture:', uploadError);
          alert('Failed to upload profile picture, but other changes will be saved.');
        } finally {
          setUploadingPicture(false);
        }
      }

      await updateDoc(docRef, updateData);

      // Refresh user profile to show new picture
      if (fetchUserProfile) {
        await fetchUserProfile(currentUser.uid);
      }

      alert('Profile updated successfully!');
      navigate('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-6">
          <div className="card p-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 animate-fade-in">
        <div className="card p-8 animate-slide-in-up">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/profile')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <ArrowBackIcon />
            </button>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
              Edit Profile
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center">
              <label className="block text-sm font-medium mb-3 text-center w-full" style={{ color: 'var(--text)' }}>
                Profile Picture
              </label>
              <div className="relative">
                {/* Profile Picture Display */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border-4 border-gray-200 dark:border-gray-700">
                  {profilePicturePreview ? (
                    <img
                      src={profilePicturePreview}
                      alt="Profile Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PersonIcon sx={{ fontSize: { xs: 64, sm: 80 } }} className="text-gray-400" />
                  )}
                </div>
                
                {/* Camera Button Overlay */}
                <label
                  htmlFor="profile-picture-upload"
                  className="absolute bottom-0 right-0 bg-green-600 hover:bg-green-700 text-white rounded-full p-3 cursor-pointer shadow-lg transition-all hover:scale-110 active:scale-95"
                  title="Upload Profile Picture"
                >
                  <PhotoCameraIcon sx={{ fontSize: 20 }} />
                  <input
                    id="profile-picture-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                </label>
              </div>
              
              <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
                Click the camera icon to upload a new profile picture (max 5MB)
              </p>
              
              {uploadingPicture && (
                <div className="mt-2 flex items-center gap-2 text-green-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  <span className="text-sm">Uploading picture...</span>
                </div>
              )}
            </div>

            {/* Title/Bio */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Username
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
                placeholder="e.g., Bubble Princess"
              />
            </div>

            {/* Age */}
            <div>
              <label htmlFor="age" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Age
              </label>
              <input
                type="text"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
                placeholder="18"
              />
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="gender" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Gender
              </label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
                placeholder="Ha Noi, VietNam"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={currentUser?.email || ''}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                style={{ color: 'var(--text)' }}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
                placeholder="(+84) 329 661 441"
              />
            </div>

            {/* Bio/About */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                About / Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="4"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                style={{ color: 'var(--text)' }}
                placeholder="I want to spread kindness"
              />
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                Website / Social Links
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ color: 'var(--text)' }}
                placeholder="https://..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
                style={{ color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EditProfile;
