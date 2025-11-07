import { useState, useEffect } from 'react';
import { formatCurrencyShort } from '../../utils/numberFormat';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
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
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchTransactions = async () => {
    try {
      console.log('Fetching transactions for user:', currentUser.uid);
      
      // Fetch transactions where user is donor or recipient
      // Prefer ordered queries; fall back to non-indexed queries and sort client-side
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

      let donorSnapshot, recipientSnapshot;
      try {
        donorSnapshot = await getDocs(q1);
      } catch (e) {
        console.warn('Donor query requires index, using fallback without orderBy:', e?.message);
        const donorFallback = query(
          collection(db, 'transactions'),
          where('donorId', '==', currentUser.uid)
        );
        donorSnapshot = await getDocs(donorFallback);
      }
      try {
        recipientSnapshot = await getDocs(q2);
      } catch (e) {
        console.warn('Recipient query requires index, using fallback without orderBy:', e?.message);
        const recipientFallback = query(
          collection(db, 'transactions'),
          where('recipientId', '==', currentUser.uid)
        );
        recipientSnapshot = await getDocs(recipientFallback);
      }

      console.log('Donor transactions found:', donorSnapshot.size);
      console.log('Recipient transactions found:', recipientSnapshot.size);

      // Create a map to avoid duplicates (important for top-ups where donor=recipient)
      const transactionMap = new Map();

      // Add donor transactions
      donorSnapshot.docs.forEach(doc => {
        const data = doc.data();
        transactionMap.set(doc.id, {
          id: doc.id,
          ...data,
          role: 'donor'
        });
        console.log('Added donor transaction:', doc.id, data.type);
      });

      // Add recipient transactions (skip if already in map from donor side)
      recipientSnapshot.docs.forEach(doc => {
        if (!transactionMap.has(doc.id)) {
          const data = doc.data();
          transactionMap.set(doc.id, {
            id: doc.id,
            ...data,
            role: 'recipient'
          });
          console.log('Added recipient transaction:', doc.id, data.type);
        } else {
          console.log('Skipped duplicate transaction:', doc.id);
        }
      });

      const allTransactions = Array.from(transactionMap.values()).sort((a, b) => {
        // Handle Firestore Timestamp objects
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      console.log('Total unique transactions:', allTransactions.length);
      if (allTransactions.length > 0) {
        console.log('Sample transaction:', allTransactions[0]);
        console.log('All transaction types:', allTransactions.map(t => t.type));
      } else {
        console.warn('No transactions found! Check Firestore rules and indexes.');
      }

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      console.error('Error details:', error.message);
      alert('Error loading transactions. Check browser console for details.');
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
      console.log('Starting top-up process...');
      console.log('Amount:', amount);
      console.log('User ID:', currentUser.uid);
      console.log('Display Name:', userProfile?.displayName || currentUser.displayName);

      // Update user wallet balance
      await updateDoc(doc(db, 'users', currentUser.uid), {
        walletBalance: increment(amount)
      });
      console.log('Wallet balance updated successfully');

      // Create transaction record for top-up
      const transactionData = {
        type: 'topup',
        amount,
        donorId: currentUser.uid,
        recipientId: currentUser.uid,
        donorName: userProfile?.displayName || currentUser.displayName || 'You',
        recipientName: userProfile?.displayName || currentUser.displayName || 'You',
        postTitle: 'Wallet Top-Up',
        message: '',
        createdAt: serverTimestamp(),
      };
      
      console.log('Creating transaction with data:', transactionData);
      
      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      
      console.log('Top-up transaction created successfully with ID:', docRef.id);

      // Wait a moment for Firestore to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh user profile and transactions
      console.log('Refreshing user profile...');
      await fetchUserProfile(currentUser.uid);
      
      console.log('Fetching transactions...');
      await fetchTransactions();

      alert(`Successfully added ${formatCurrency(amount)} to your wallet!`);
      setTopUpAmount('');
      setShowTopUp(false);
    } catch (error) {
      console.error('Error topping up wallet:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      alert('Failed to top up wallet. Check console for details.');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const totalReceivedCalc = transactions
      .filter((t) => t.role === 'recipient')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const availableBalance = (Number(userProfile?.walletBalance) || 0) + totalReceivedCalc;

    if (amount > availableBalance) {
      alert('Insufficient balance for withdrawal');
      return;
    }

    try {
      setProcessing(true);
      console.log('Starting withdrawal process...');
      console.log('Amount:', amount);

      // Update user wallet balance
      await updateDoc(doc(db, 'users', currentUser.uid), {
        walletBalance: increment(-amount)
      });
      console.log('Wallet balance updated successfully');

      // Create transaction record for withdrawal
      const transactionData = {
        type: 'withdraw',
        amount,
        donorId: currentUser.uid,
        recipientId: currentUser.uid,
        donorName: userProfile?.displayName || currentUser.displayName || 'You',
        recipientName: userProfile?.displayName || currentUser.displayName || 'You',
        postTitle: 'Wallet Withdrawal',
        message: '',
        createdAt: serverTimestamp(),
      };
      
      console.log('Creating withdrawal transaction with data:', transactionData);
      
      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      
      console.log('Withdrawal transaction created successfully with ID:', docRef.id);

      // Wait a moment for Firestore to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh user profile and transactions
      await fetchUserProfile(currentUser.uid);
      await fetchTransactions();

      alert(`Successfully withdrawn ${formatCurrency(amount)} from your wallet!`);
      setWithdrawAmount('');
      setShowWithdraw(false);
    } catch (error) {
      console.error('Error withdrawing from wallet:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      alert('Failed to withdraw. Check console for details.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => formatCurrencyShort(amount, { maxDigits: 5 });

  // Derived totals
  const totalDonatedCalc = transactions
    .filter((t) => t.role === 'donor' && t.type === 'donation')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalReceivedCalc = transactions
    .filter((t) => t.role === 'recipient')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  // Wallet balance includes liquid funds plus received donations
  const actualBalance = (Number(userProfile?.walletBalance) || 0) + totalReceivedCalc;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8 animate-slide-in-up">
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>Wallet</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your funds and transaction history</p>
        </div>

        {/* Wallet Balance Card */}
        <div className="card p-4 sm:p-8 mb-8" style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' }}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <p className="text-white/80 mb-2 text-sm sm:text-base">Available Balance</p>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4 sm:mb-6 text-white">
                {formatCurrency(actualBalance)}
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowTopUp(!showTopUp);
                    setShowWithdraw(false);
                  }}
                  className="bg-white px-4 sm:px-6 py-2 sm:py-3 rounded-full font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  style={{ color: '#16a34a' }}
                >
                  <AddIcon fontSize="small" />
                  <span className="hidden sm:inline">Top Up Wallet</span>
                  <span className="sm:hidden">Top Up</span>
                </button>
                <button
                  onClick={() => {
                    setShowWithdraw(!showWithdraw);
                    setShowTopUp(false);
                  }}
                  className="bg-white px-4 sm:px-6 py-2 sm:py-3 rounded-full font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                  style={{ color: '#dc2626' }}
                >
                  <RemoveIcon fontSize="small" />
                  Withdraw
                </button>
              </div>
            </div>
            <AccountBalanceWalletIcon sx={{ fontSize: { xs: 80, sm: 120 }, opacity: 0.2, color: 'white' }} className="hidden sm:block" />
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

        {/* Withdraw Form */}
        {showWithdraw && (
          <div className="card p-6 mb-8">
            <h3 className="text-xl font-bold text-themed mb-4">Withdraw Funds</h3>
            <form onSubmit={handleWithdraw} className="flex gap-4">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="input-field flex-1"
                placeholder="Enter amount"
                min="1"
                step="0.01"
                max={actualBalance}
                required
              />
              <button
                type="submit"
                disabled={processing}
                className="btn-primary bg-error hover:bg-error/90"
              >
                {processing ? 'Processing...' : 'Withdraw'}
              </button>
              <button
                type="button"
                onClick={() => setShowWithdraw(false)}
                className="btn-outline"
              >
                Cancel
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-2">
              Available balance: {formatCurrency(actualBalance)}
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
              {formatCurrency(totalDonatedCalc || userProfile?.totalDonated || 0)}
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
              {formatCurrency(totalReceivedCalc || userProfile?.totalReceived || 0)}
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
            {transactions.map((transaction) => {
              const isTopUp = transaction.type === 'topup';
              const isWithdraw = transaction.type === 'withdraw';
              const isDonor = transaction.role === 'donor';
              
              return (
                <div
                  key={transaction.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-outline-variant rounded-xl transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center ${
                        isTopUp
                          ? 'bg-blue-50'
                          : isWithdraw
                          ? 'bg-orange-50'
                          : isDonor
                          ? 'bg-error-50'
                          : 'bg-green-50'
                      }`}
                    >
                      {isTopUp ? (
                        <AddIcon className="text-blue-600" fontSize="small" />
                      ) : isWithdraw ? (
                        <RemoveIcon className="text-orange-600" fontSize="small" />
                      ) : isDonor ? (
                        <TrendingDownIcon className="text-error" fontSize="small" />
                      ) : (
                        <TrendingUpIcon className="text-green-600" fontSize="small" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-themed text-sm sm:text-base">
                        {isTopUp 
                          ? 'Wallet Top-Up'
                          : isWithdraw
                          ? 'Wallet Withdrawal'
                          : isDonor 
                          ? 'Donation Sent' 
                          : 'Donation Received'}
                      </p>
                      {!isTopUp && !isWithdraw && (
                        <p className="text-xs sm:text-sm text-themed-secondary truncate">
                          {isDonor
                            ? `To: ${transaction.recipientName}`
                            : `From: ${transaction.donorName}`}
                        </p>
                      )}
                      {transaction.postTitle && transaction.postTitle !== 'Wallet Top-Up' && transaction.postTitle !== 'Wallet Withdrawal' && (
                        <p className="text-xs text-themed-muted mt-1 truncate">
                          {transaction.postTitle}
                        </p>
                      )}
                      {transaction.message && (
                        <p className="text-xs sm:text-sm text-themed-secondary mt-1 italic line-clamp-2">
                          "{transaction.message}"
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {transaction.createdAt?.toDate 
                          ? transaction.createdAt.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(transaction.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right sm:text-right flex sm:block justify-between items-center sm:items-end">
                    <p
                      className={`text-lg sm:text-xl font-bold ${
                        isTopUp
                          ? 'text-blue-600'
                          : isWithdraw
                          ? 'text-orange-600'
                          : isDonor
                          ? 'text-error'
                          : 'text-green-600'
                      }`}
                    >
                      {isDonor && !isTopUp && !isWithdraw ? '-' : isWithdraw ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Wallet;
