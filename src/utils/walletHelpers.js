import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Calculate accurate wallet statistics from transactions
 * This is the single source of truth for wallet data across the app
 */
export const calculateWalletStats = async (userId) => {
  if (!userId) {
    return {
      totalDonated: 0,
      totalReceived: 0,
      transactions: []
    };
  }

  try {
    // Fetch transactions where user is donor or recipient
    const q1 = query(
      collection(db, 'transactions'),
      where('donorId', '==', userId)
    );
    const q2 = query(
      collection(db, 'transactions'),
      where('recipientId', '==', userId)
    );

    const [donorSnapshot, recipientSnapshot] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

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
      }
    });

    const allTransactions = Array.from(transactionMap.values());

    // Calculate totals - only count actual donations, not top-ups/withdrawals
    const totalDonated = allTransactions
      .filter((t) => t.role === 'donor' && t.type === 'donation')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    
    const totalReceived = allTransactions
      .filter((t) => t.role === 'recipient' && t.type === 'donation')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      totalDonated,
      totalReceived,
      transactions: allTransactions
    };
  } catch (error) {
    console.error('Error calculating wallet stats:', error);
    return {
      totalDonated: 0,
      totalReceived: 0,
      transactions: []
    };
  }
};

/**
 * Format currency consistently across the app
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

/**
 * Format amount for compact display (e.g., $1.5k)
 */
export const formatCompactCurrency = (amount) => {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount || 0}`;
};
