import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';

const Wallet = () => {
  const { currentUser, userProfile, fetchUserProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchTransactions();
    }
  }, [currentUser]);

  const fetchTransactions = async () => {
    try {
      // Fetch transactions where user is donor or recipient
      const q1 = query(
        collection(db, 'transactions'),
        where('donorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const q2 = query(
        collection(db, 'transactions'),
        where('recipientId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );

      const [donorSnapshot, recipientSnapshot] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);

      const allTransactions = [
        ...donorSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: 'donor'
        })),
        ...recipientSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          role: 'recipient'
        }))
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setProcessing(true);

      // Update user wallet balance
      await updateDoc(doc(db, 'users', currentUser.uid), {
        walletBalance: increment(amount)
      });

      // Refresh user profile
      await fetchUserProfile(currentUser.uid);

      alert(`Successfully added ${formatCurrency(amount)} to your wallet!`);
      setTopUpAmount('');
      setShowTopUp(false);
    } catch (error) {
      console.error('Error topping up wallet:', error);
      alert('Failed to top up wallet. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your funds and transaction history</p>
        </div>

        {/* Wallet Balance Card */}
        <div className="card p-8 mb-8" style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 mb-2">Available Balance</p>
              <h2 className="text-5xl font-bold mb-6 text-white">
                {formatCurrency(userProfile?.walletBalance || 0)}
              </h2>
              <button
                onClick={() => setShowTopUp(!showTopUp)}
                className="bg-white px-6 py-3 rounded-full font-medium hover:bg-gray-100 transition-colors flex items-center gap-2"
                style={{ color: '#16a34a' }}
              >
                <AddIcon fontSize="small" />
                Top Up Wallet
              </button>
            </div>
            <AccountBalanceWalletIcon sx={{ fontSize: 120, opacity: 0.2, color: 'white' }} />
          </div>
        </div>

        {/* Top Up Form */}
        {showTopUp && (
          <div className="card p-6 mb-8">
            <h3 className="text-xl font-bold text-themed mb-4">Top Up Wallet</h3>
            <form onSubmit={handleTopUp} className="flex gap-4">
              <input
                type="number"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="input-field flex-1"
                placeholder="Enter amount"
                min="1"
                step="0.01"
                required
              />
              <button
                type="submit"
                disabled={processing}
                className="btn-primary"
              >
                {processing ? 'Processing...' : 'Add Funds'}
              </button>
              <button
                type="button"
                onClick={() => setShowTopUp(false)}
                className="btn-outline"
              >
                Cancel
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-2">
              Note: In a production app, this would integrate with a payment gateway like Stripe
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary-50 p-2 rounded-lg">
                <VolunteerActivismIcon className="text-primary" />
              </div>
              <p className="text-themed-secondary">Total Donated</p>
            </div>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(userProfile?.totalDonated || 0)}
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-secondary-50 p-2 rounded-lg">
                <TrendingUpIcon className="text-secondary" />
              </div>
              <p className="text-themed-secondary">Total Received</p>
            </div>
            <p className="text-3xl font-bold text-secondary">
              {formatCurrency(userProfile?.totalReceived || 0)}
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-tertiary-50 p-2 rounded-lg">
                <AccountBalanceWalletIcon className="text-tertiary" />
              </div>
              <p className="text-themed-secondary">Transactions</p>
            </div>
            <p className="text-3xl font-bold text-tertiary">
              {transactions.length}
            </p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="card p-6">
          <h3 className="text-xl font-bold text-themed mb-6">Transaction History</h3>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && transactions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-themed-secondary text-lg">No transactions yet</p>
            </div>
          )}

          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border border-outline-variant rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      transaction.role === 'donor'
                        ? 'bg-error-50'
                        : 'bg-green-50'
                    }`}
                  >
                    {transaction.role === 'donor' ? (
                      <TrendingDownIcon className="text-error" />
                    ) : (
                      <TrendingUpIcon className="text-green-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-themed">
                      {transaction.role === 'donor' ? 'Donation Sent' : 'Donation Received'}
                    </p>
                    <p className="text-sm text-themed-secondary">
                      {transaction.role === 'donor'
                        ? `To: ${transaction.recipientName}`
                        : `From: ${transaction.donorName}`}
                    </p>
                    <p className="text-xs text-themed-muted mt-1">
                      {transaction.postTitle}
                    </p>
                    {transaction.message && (
                      <p className="text-sm text-themed-secondary mt-1 italic">
                        "{transaction.message}"
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(transaction.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      transaction.role === 'donor'
                        ? 'text-error'
                        : 'text-green-600'
                    }`}
                  >
                    {transaction.role === 'donor' ? '-' : '+'}
                    {formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Wallet;
