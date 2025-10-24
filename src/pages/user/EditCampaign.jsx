import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const EditCampaign = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const { currentUser } = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState({
		title: '',
		description: '',
		category: '',
		goalAmount: '',
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
        
				// Check if current user is the campaign owner
				if (data.authorId !== currentUser.uid) {
					alert('You do not have permission to edit this campaign');
					navigate('/profile');
					return;
				}
        
				setFormData({
					title: data.title || '',
					description: data.description || '',
					category: data.category || '',
					goalAmount: data.goalAmount || '',
				});
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
			const docRef = doc(db, 'posts', id);
			await updateDoc(docRef, {
				title: formData.title,
				titleLower: (formData.title || '').toLowerCase().trim(),
				description: formData.description,
				category: formData.category,
				goalAmount: parseFloat(formData.goalAmount),
				updatedAt: new Date(),
			});

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
								<option value="Business">Business</option>
								<option value="Creative">Creative</option>
								<option value="Other">Other</option>
							</select>
						</div>

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

						<div className="flex gap-4">
							<button
								type="submit"
								disabled={saving}
								className="btn-primary flex-1"
							>
								{saving ? 'Saving...' : 'Save Changes'}
							</button>
							<button
								type="button"
								onClick={() => navigate('/profile')}
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

export default EditCampaign;