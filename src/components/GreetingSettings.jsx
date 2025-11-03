import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Save, MessageSquare, Info } from 'lucide-react';

const GreetingSettings = ({ userId }) => {
  const [greetingMessage, setGreetingMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGreeting = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setGreetingMessage(userDoc.data().greetingMessage || '');
        }
      } catch (error) {
        console.error('Error fetching greeting:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGreeting();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);

    try {
      await updateDoc(doc(db, 'users', userId), {
        greetingMessage: greetingMessage.trim()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving greeting:', error);
      alert('Failed to save greeting message. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable) => {
    setGreetingMessage(prev => prev + variable);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-themed-secondary rounded-xl p-6 border border-themed-border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="text-green-600" size={24} />
        <div>
          <h3 className="text-lg font-bold text-themed">Auto-Greeting Message</h3>
          <p className="text-sm text-themed-muted">
            Automatically sent when someone first messages you
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 flex gap-3">
        <Info className="text-blue-600 shrink-0" size={20} />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>This message is sent <strong>only once</strong> when someone messages you for the first time</li>
            <li>Use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{RecipientName}'}</code> to personalize with their name</li>
            <li>Leave blank to disable auto-greeting</li>
          </ul>
        </div>
      </div>

      {/* Textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-themed mb-2">
          Greeting Message
        </label>
        <textarea
          value={greetingMessage}
          onChange={(e) => setGreetingMessage(e.target.value)}
          placeholder="Hi {RecipientName}! Thanks for reaching out. How can I help you today?"
          className="w-full px-4 py-3 bg-themed border border-themed-border rounded-lg text-themed placeholder-themed-muted focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          rows={4}
          maxLength={500}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-themed-muted">
            {greetingMessage.length}/500 characters
          </span>
        </div>
      </div>

      {/* Variable Buttons */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-themed mb-2">
          Insert Variables:
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => insertVariable('{RecipientName}')}
            className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            + Recipient Name
          </button>
        </div>
      </div>

      {/* Preview */}
      {greetingMessage.trim() && (
        <div className="mb-4 p-4 bg-themed rounded-lg border border-themed-border">
          <p className="text-xs font-semibold text-themed-muted mb-2 uppercase">Preview:</p>
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-themed whitespace-pre-wrap">
              {greetingMessage.replace(/\{RecipientName\}/g, 'John Doe')}
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Greeting
            </>
          )}
        </button>

        {success && (
          <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved successfully!
          </span>
        )}
      </div>
    </div>
  );
};

export default GreetingSettings;
