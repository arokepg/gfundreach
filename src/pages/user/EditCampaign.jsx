import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getMember } from '../../utils/groups';
import { db } from '../../config/firebase';
import { uploadImage } from '../../utils/uploadHelpers';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { compressImageFile } from '../../utils/imageUtils';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';

const EditCampaign = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { currentUser } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [image, setImage] = useState(null);
	const [imagePreview, setImagePreview] = useState(null);
	const [currentImageUrl, setCurrentImageUrl] = useState('');
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		shortSummary: '',
		category: '',
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
		suggestedCsv: '',
	});

	useEffect(() => {
		fetchCampaignData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id]);

	const fetchCampaignData = async () => {
		try {
			const docRef = doc(db, 'posts', id);
			const docSnap = await getDoc(docRef);
      
			if (docSnap.exists()) {
				const data = docSnap.data();
        
						// Check if current user is the campaign owner OR a group admin/moderator for this campaign's group
						let canEdit = data.authorId === currentUser.uid;
						if (!canEdit && data.groupId) {
							try {
								const member = await getMember(String(data.groupId), currentUser.uid);
								if (member && (member.role === 'admin' || member.role === 'moderator')) canEdit = true;
							} catch {/* ignore */}
						}
						if (!canEdit) {
							alert('You do not have permission to edit this campaign');
							navigate('/profile');
							return;
						}
        
				setFormData({
					title: data.title || '',
					description: data.description || '',
					shortSummary: data.shortSummary || '',
					category: data.category || '',
					goalAmount: data.goalAmount || '',
					locationCity: data.locationCity || '',
					locationCountry: data.locationCountry || '',
					tagsCsv: (data.tags || []).join(', '),
					deadline: data.deadline || '',
					videoUrl: data.videoUrl || '',
					beneficiaryName: data.beneficiaryName || '',
					beneficiaryRelation: data.beneficiaryRelation || '',
					visibility: data.visibility || 'public',
					minDonation: data.minDonation || '',
					suggestedCsv: (data.suggestedAmounts || []).join(', '),
				});
				setCurrentImageUrl(data.imageUrl || '');
				setImagePreview(data.imageUrl || '');
			} else {
				alert('Campaign not found');
				navigate('/profile');
			}
		} catch (error) {
			console.error('Error fetching campaign:', error);
			alert('Failed to load campaign data');
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSaving(true);

		try {
			let imageUrl = currentImageUrl;

			// Upload new image if selected
			if (image) {
				const storagePath = `campaigns/${id}/${Date.now()}_${image.name || 'image.jpg'}`;
				imageUrl = await uploadImage(image, storagePath);
			}

			const docRef = doc(db, 'posts', id);
			const updateData = {
				title: formData.title,
				titleLower: (formData.title || '').toLowerCase().trim(),
				description: formData.description,
				shortSummary: formData.shortSummary,
				category: formData.category,
				goalAmount: parseFloat(formData.goalAmount) || 0,
				locationCity: formData.locationCity,
				locationCountry: formData.locationCountry,
				tags: formData.tagsCsv.split(',').map(tag => tag.trim()).filter(Boolean),
				deadline: formData.deadline,
				videoUrl: formData.videoUrl,
				beneficiaryName: formData.beneficiaryName,
				beneficiaryRelation: formData.beneficiaryRelation,
				visibility: formData.visibility,
				minDonation: parseFloat(formData.minDonation) || 0,
				suggestedAmounts: formData.suggestedCsv.split(',').map(amt => parseFloat(amt.trim())).filter(Boolean),
				imageUrl: imageUrl,
				updatedAt: new Date(),
			};

			await updateDoc(docRef, updateData);

			alert('Campaign updated successfully!');
			navigate('/profile');
		} catch (error) {
			console.error('Error updating campaign:', error);
			alert('Failed to update campaign. Please try again.');
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

	const handleImageChange = async (e) => {
			const file = e.target.files[0];
			if (file) {
				const compressed = await compressImageFile(file, 1600, 0.82);
				setImage(compressed);
				const reader = new FileReader();
				reader.onloadend = () => {
					setImagePreview(reader.result);
				};
				reader.readAsDataURL(compressed);
			}
	};

	const removeImage = () => {
		setImage(null);
		setImagePreview(currentImageUrl || null);
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
			<div className="max-w-3xl mx-auto p-6">
				<button
					onClick={() => navigate('/profile')}
					className="flex items-center gap-2 text-themed-secondary hover:text-themed mb-6 transition-colors"
				>
					<ArrowBackIcon />
					<span>Back to Profile</span>
				</button>

				<div className="card p-8">
					<h1 className="text-3xl font-bold text-themed mb-6">Edit Campaign</h1>

					<form onSubmit={handleSubmit} className="space-y-6">
						{/* Campaign Image */}
						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Campaign Image
							</label>
							<div className="flex flex-col gap-4">
								{imagePreview && (
									<div className="relative w-full h-64 rounded-lg overflow-hidden">
										<img
											src={imagePreview}
											alt="Campaign preview"
											className="w-full h-full object-cover"
										/>
										{image && (
											<button
												type="button"
												onClick={removeImage}
												className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
											>
												<CloseIcon fontSize="small" />
											</button>
										)}
									</div>
								)}
								<label className="btn-secondary cursor-pointer inline-flex items-center justify-center gap-2">
									<CloudUploadIcon />
									<span>{image ? 'Change Image' : imagePreview ? 'Change Image' : 'Upload Image'}</span>
									<input
										type="file"
										accept="image/*"
										onChange={handleImageChange}
										className="hidden"
									/>
								</label>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Campaign Title *
							</label>
							<input
								type="text"
								name="title"
								value={formData.title}
								onChange={handleChange}
								required
								className="input-field"
								placeholder="Enter campaign title"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Short Summary
							</label>
							<input
								type="text"
								name="shortSummary"
								value={formData.shortSummary}
								onChange={handleChange}
								className="input-field"
								placeholder="Brief one-line summary"
								maxLength="150"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Category *
							</label>
							<select
								name="category"
								value={formData.category}
								onChange={handleChange}
								required
								className="input-field"
							>
								<option value="">Select a category</option>
								<option value="Medical">Medical</option>
								<option value="Education">Education</option>
								<option value="Emergency">Emergency</option>
								<option value="Community">Community</option>
								<option value="Animal Welfare">Animal Welfare</option>
								<option value="Environment">Environment</option>
								<option value="Arts & Culture">Arts & Culture</option>
								<option value="Business">Business</option>
								<option value="Creative">Creative</option>
								<option value="Other">Other</option>
							</select>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									Goal Amount (USD) *
								</label>
								<input
									type="number"
									name="goalAmount"
									value={formData.goalAmount}
									onChange={handleChange}
									required
									min="1"
									step="0.01"
									className="input-field"
									placeholder="Enter goal amount"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									Minimum Donation
								</label>
								<input
									type="number"
									name="minDonation"
									value={formData.minDonation}
									onChange={handleChange}
									min="0"
									step="0.01"
									className="input-field"
									placeholder="Minimum amount (optional)"
								/>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Description *
							</label>
							<textarea
								name="description"
								value={formData.description}
								onChange={handleChange}
								required
								rows="6"
								className="input-field resize-none"
								placeholder="Tell people about your campaign..."
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									City/Location
								</label>
								<input
									type="text"
									name="locationCity"
									value={formData.locationCity}
									onChange={handleChange}
									className="input-field"
									placeholder="City or location"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									Country
								</label>
								<input
									type="text"
									name="locationCountry"
									value={formData.locationCountry}
									onChange={handleChange}
									className="input-field"
									placeholder="Country"
								/>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									Beneficiary Name
								</label>
								<input
									type="text"
									name="beneficiaryName"
									value={formData.beneficiaryName}
									onChange={handleChange}
									className="input-field"
									placeholder="Who will benefit from this campaign?"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-themed mb-2">
									Your Relation to Beneficiary
								</label>
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

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Deadline
							</label>
							<input
								type="date"
								name="deadline"
								value={formData.deadline}
								onChange={handleChange}
								className="input-field"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Video URL (Optional)
							</label>
							<input
								type="url"
								name="videoUrl"
								value={formData.videoUrl}
								onChange={handleChange}
								className="input-field"
								placeholder="YouTube, Vimeo, or other video link"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Tags (comma separated)
							</label>
							<input
								type="text"
								name="tagsCsv"
								value={formData.tagsCsv}
								onChange={handleChange}
								className="input-field"
								placeholder="e.g., medical, urgent, help"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Suggested Donation Amounts (comma separated)
							</label>
							<input
								type="text"
								name="suggestedCsv"
								value={formData.suggestedCsv}
								onChange={handleChange}
								className="input-field"
								placeholder="e.g., 10, 25, 50, 100"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-themed mb-2">
								Visibility
							</label>
							<select
								name="visibility"
								value={formData.visibility}
								onChange={handleChange}
								className="input-field"
							>
								<option value="public">Public - Anyone can see</option>
								<option value="unlisted">Unlisted - Only with link</option>
								<option value="private">Private - Only you</option>
							</select>
						</div>

						<div className="flex gap-4 pt-4">
							<button
								type="submit"
								disabled={saving}
								className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
							>
								{saving ? 'Saving...' : 'Save Changes'}
							</button>
							<button
								type="button"
								onClick={() => navigate('/profile')}
								className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
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

export default EditCampaign;