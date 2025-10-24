import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, getDocs, limit, collectionGroup } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link, useLocation } from 'react-router-dom';
import RightSidebar from '../../components/RightSidebar';
import FilterTabs from '../../components/FilterTabs';
import PostCard from '../../components/PostCard';
import CommunityPostCard from '../../components/CommunityPostCard';
import GroupItemCard from '../../components/GroupItemCard';
import Layout from '../../components/Layout';

const Home = () => {
  const [posts, setPosts] = useState([]); // mixed: campaigns + updates
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const location = useLocation();
  const mountedRef = useRef(true);
  // Layout provides header, sidebar, and search sidebar

  useEffect(() => {
    mountedRef.current = true;
    // Refetch whenever we navigate to this route (even if React reuses the instance)
    fetchPosts();
    return () => { mountedRef.current = false; };
  }, [location.key]);

  const fetchPosts = async () => {
    // Reset list and start loading
    setFilteredPosts([]);
    setPosts([]);
    setLoading(true); // Ensure loading state is set
    // Fail-safe: never let the spinner hang forever
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        console.warn('⏳ Home feed timed out after 10s; showing whatever we have.');
        setLoading(false);
      }
    }, 10000);
    try {
      // Each query is isolated so a failure (missing index/permission) doesn't blank the whole feed
      let campaigns = [];
      let updates = [];
      let groupItems = [];

      // Campaigns
      try {
        const campaignQuery = query(
          collection(db, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const campaignSnap = await getDocs(campaignQuery);
        campaigns = campaignSnap.docs.map(d => ({ id: d.id, type: 'campaign', ...d.data() }));
        console.log(`✅ Loaded ${campaigns.length} campaigns`);
      } catch (e) {
        console.warn('❌ Failed to load campaigns', e);
      }

      // Community posts (updates)
      try {
        // Avoid requiring a composite index by omitting orderBy here; we'll sort client-side
        const updatesQuery = query(
          collectionGroup(db, 'updates'),
          limit(20)
        );
        const updatesSnap = await getDocs(updatesQuery);
        updates = updatesSnap.docs.map(d => {
          const campaignId = d.ref.parent.parent?.id;
          return { id: d.id, type: 'update', campaignId, ...d.data() };
        });
      } catch (e) {
        // Likely needs a collection group index; keep feed working with campaigns only
        console.warn('Failed to load campaign updates (likely missing index). Showing campaigns only for now.', e);
      }

      // Group items
      try {
        // Avoid requiring a composite index by omitting orderBy here; we'll sort client-side
        const groupPostsQuery = query(
          collectionGroup(db, 'posts'),
          limit(20)
        );
        const groupSnap = await getDocs(groupPostsQuery);
        groupItems = groupSnap.docs.map(d => {
          const groupId = d.ref.parent.parent?.id;
          const data = d.data();
          const kind = data.type === 'campaign' ? 'group-campaign' : 'group-post';
          return { id: d.id, groupId, type: kind, ...data };
        });
      } catch (e) {
        console.warn('Failed to load group posts (likely missing index). Proceeding without them.', e);
      }

      // Fallback: if collectionGroup for updates returned nothing, fetch a few recent campaigns' updates directly
      if (updates.length === 0 && campaigns.length > 0) {
        try {
          const perCampaign = 3;
          const promises = campaigns.slice(0, 10).map(async (c) => {
            try {
              const upSnap = await getDocs(query(collection(db, 'posts', c.id, 'updates'), limit(perCampaign)));
              return upSnap.docs.map(d => ({ id: d.id, type: 'update', campaignId: c.id, ...d.data() }));
            } catch { return []; }
          });
          const all = await Promise.all(promises);
          updates = all.flat();
        } catch (e) {
          console.warn('Fallback update fetch failed', e);
        }
      }

      // Fallback: if group items empty, fetch a few groups and their posts directly
      if (groupItems.length === 0) {
        try {
          const grpSnap = await getDocs(query(collection(db, 'groups'), limit(8)));
          const groups = grpSnap.docs.map(d => ({ id: d.id }));
          const perGroup = 3;
          const promises = groups.map(async (g) => {
            try {
              const gpSnap = await getDocs(query(collection(db, 'groups', g.id, 'posts'), limit(perGroup)));
              return gpSnap.docs.map(d => {
                const data = d.data();
                const kind = data.type === 'campaign' ? 'group-campaign' : 'group-post';
                return { id: d.id, groupId: g.id, type: kind, ...data };
              });
            } catch { return []; }
          });
          const all = await Promise.all(promises);
          groupItems = all.flat();
        } catch (e) {
          console.warn('Fallback group items fetch failed', e);
        }
      }

      // Merge and sort by createdAt
      const merged = [...campaigns, ...updates, ...groupItems].sort((a, b) => {
        const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return bDate - aDate;
      });

      if (!mountedRef.current) return;
      setPosts(merged);
      setFilteredPosts(merged);
      console.log(`📊 Total items in feed: ${merged.length} (${campaigns.length} campaigns, ${updates.length} updates, ${groupItems.length} group items)`);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      clearTimeout(timeout);
      if (mountedRef.current) setLoading(false);
      console.log('✅ Loading complete');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilteredPosts(posts);
  };

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Column - Feed */}
        <div className="lg:col-span-2">
          <div className="mb-4 md:mb-6 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text)' }}>
              Latest posts
            </h2>
            <FilterTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading posts...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 card">
              <p className="text-gray-600 dark:text-gray-400">No posts found</p>
            </div>
          ) : (
            <div className="space-y-4 md:space-y-6">
              {filteredPosts.map((item) => {
                if (item.type === 'update') return <CommunityPostCard key={`upd-${item.id}`} post={item} />;
                if (item.type === 'campaign') return <PostCard key={`camp-${item.id}`} post={item} />;
                if (item.type === 'group-post' || item.type === 'group-campaign') {
                  return <GroupItemCard key={`grp-${item.id}`} item={item} />;
                }
                return null;
              })}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar (Hidden on mobile) */}
        <div className="hidden lg:block lg:col-span-1">
          <RightSidebar />
        </div>
      </div>
    </Layout>
  );
};

export default Home;
