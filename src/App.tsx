import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  User as UserIcon, 
  Heart, 
  Plus, 
  Minus, 
  Inbox, 
  Store, 
  History as HistoryIcon, 
  LogOut, 
  Send, 
  Check, 
  X, 
  Edit2,
  Copy,
  Link as LinkIcon,
  ChevronRight,
  Sparkles,
  Trash2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { User, Application, Reward, HistoryItem, PointProject, RedemptionRequest, WishlistItem } from './types';

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'brand';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    brand: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
    outline: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg font-medium',
  };
  return (
    <button 
      className={cn(
        'rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('bg-white rounded-[2rem] border border-brand-100 card-shadow overflow-hidden', className)} {...props}>
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn(
      'w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all',
      className
    )}
    {...props}
  />
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<'dashboard' | 'inbox' | 'store' | 'history' | 'wishlist'>('dashboard');
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [applications, setApplications] = useState<Application[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);
  const [myPendingRedemptions, setMyPendingRedemptions] = useState<number[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [projects, setProjects] = useState<PointProject[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, [user]);

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/user/${user.id}`);
    const data = await res.json();
    setUser(data);
  }, [user?.id]);

  const fetchApplications = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/applications/${user.id}`);
    const data = await res.json();
    setApplications(data);

    const redRes = await fetch(`/api/redemptions/pending/${user.id}`);
    const redData = await redRes.json();
    setRedemptionRequests(redData);
  }, [user?.id]);

  const fetchRewards = useCallback(async () => {
    if (!user?.pair_id) return;
    const res = await fetch(`/api/rewards/${user.pair_id}`);
    const data = await res.json();
    setRewards(data);

    const pendingRes = await fetch(`/api/redemptions/my-pending/${user.id}`);
    const pendingData = await pendingRes.json();
    setMyPendingRedemptions(pendingData);
  }, [user?.pair_id, user?.id]);

  const fetchProjects = useCallback(async () => {
    if (!user?.pair_id) return;
    const res = await fetch(`/api/point-projects/${user.pair_id}`);
    const data = await res.json();
    setProjects(data);
  }, [user?.pair_id]);

  const fetchWishlist = useCallback(async () => {
    if (!user?.pair_id) return;
    const res = await fetch(`/api/wishlist/${user.pair_id}`);
    const data = await res.json();
    setWishlist(data);
  }, [user?.pair_id]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/history/${user.id}`);
    const data = await res.json();
    setHistory(data);
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchApplications();
      fetchRewards();
      fetchProjects();
      fetchHistory();
      fetchWishlist();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}`);
      
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'new_application':
          case 'new_redemption_request':
            fetchApplications();
            break;
          case 'application_responded':
          case 'redemption_responded':
          case 'points_updated':
            fetchUserData();
            fetchHistory();
            if (data.type === 'redemption_responded') {
              alert(`你的兑换申请已被${data.status === 'approved' ? '同意' : '驳回'}`);
            }
            break;
          case 'pair_update':
            fetchUserData();
            break;
          case 'rewards_updated':
            fetchRewards();
            break;
          case 'projects_updated':
            fetchProjects();
            break;
          case 'wishlist_updated':
            fetchWishlist();
            break;
          case 'redemption_reminder':
            alert(`${data.from} 想要兑换 "${data.reward}"，但积分还差一点点，快去给 TA 加分吧！`);
            break;
        }
      };

      setWs(socket);
      return () => socket.close();
    }
  }, [user?.id]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('连接失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePair = async () => {
    const res = await fetch('/api/pair/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id }),
    });
    const data = await res.json();
    setUser(prev => prev ? { ...prev, pair_id: data.pairId } : null);
  };

  const handleJoinPair = async (pairId: string) => {
    const res = await fetch('/api/pair/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, pairId }),
    });
    if (res.ok) {
      fetchUserData();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-700 text-white mb-4 shadow-xl shadow-brand-700/20">
              <Heart size={32} fill="currentColor" />
            </div>
            <h1 className="text-4xl font-black text-brand-700 tracking-tighter">千里之行</h1>
          </div>

          <Card className="p-8 border-brand-100">
            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">用户名</label>
                <Input 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="输入登录名"
                  className="rounded-2xl border-brand-100 focus:border-brand-400 focus:ring-brand-400"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">密码</label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="输入密码"
                  className="rounded-2xl border-brand-100 focus:border-brand-400 focus:ring-brand-400"
                  required
                />
              </div>
              {error && <p className="text-rose-600 text-sm">{error}</p>}
              <Button type="submit" className="w-full rounded-2xl py-4 font-bold text-lg" variant="brand" disabled={loading}>
                {loading ? '处理中...' : (isLogin ? '登录' : '注册')}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-brand-600 text-sm font-bold hover:underline"
              >
                {isLogin ? '没有账号？立即注册' : '已有账号？返回登录'}
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 font-sans selection:bg-brand-200 selection:text-brand-900">
      {/* Header */}
      <header className="glass sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-sm border-b border-brand-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-700 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-700/20">
            <Heart className="text-white" size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-black text-brand-700 leading-none tracking-tight">千里之行</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-brand-100 transition-colors group"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-brand-900 leading-none">{user.username}</div>
              <div className="text-[10px] font-medium text-brand-400 mt-0.5">个人资料</div>
            </div>
            <div className="w-8 h-8 bg-brand-200 rounded-lg flex items-center justify-center text-brand-600 group-hover:bg-brand-300 transition-colors">
              <UserIcon size={16} />
            </div>
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('user');
              setUser(null);
            }}
            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-8 pb-32">
        {!user.pair_id ? (
          <PairingView onJoin={handleJoinPair} onCreate={handleCreatePair} />
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {view === 'dashboard' && (
              <DashboardView 
                user={user} 
                onApply={() => setShowApplyModal(true)} 
                onManageProjects={() => setShowProjectModal(true)}
              />
            )}
            {view === 'inbox' && (
              <InboxView 
                applications={applications} 
                redemptionRequests={redemptionRequests}
                onRefresh={fetchApplications} 
              />
            )}
            {view === 'store' && (
              <StoreView 
                rewards={rewards} 
                userPoints={user.points}
                myPendingRedemptions={myPendingRedemptions}
                onAddReward={() => setShowRewardModal(true)}
                onRefresh={fetchRewards}
                pairId={user.pair_id}
                userId={user.id}
              />
            )}
            {view === 'history' && (
              <HistoryView 
                history={history} 
                onRefresh={fetchHistory}
              />
            )}
            {view === 'wishlist' && (
              <WishlistView 
                wishlist={wishlist} 
                onAddWish={() => setShowWishlistModal(true)}
                onRefresh={fetchWishlist}
                userId={user.id}
              />
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      {user.pair_id && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 glass rounded-[2.5rem] px-6 py-4 z-50 shadow-2xl border-brand-100 flex items-center gap-6 min-w-[320px] justify-center text-slate-400">
          <NavButton 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')} 
            icon={<Trophy size={20} />} 
            label="主页" 
          />
          <NavButton 
            active={view === 'inbox'} 
            onClick={() => setView('inbox')} 
            icon={<Inbox size={20} />} 
            label="收件箱" 
            badge={(applications.length + redemptionRequests.length) > 0 ? (applications.length + redemptionRequests.length) : undefined}
          />
          <NavButton 
            active={view === 'store'} 
            onClick={() => setView('store')} 
            icon={<Store size={20} />} 
            label="商店" 
          />
          <NavButton 
            active={view === 'wishlist'} 
            onClick={() => setView('wishlist')} 
            icon={<Star size={20} />} 
            label="心愿" 
          />
          <NavButton 
            active={view === 'history'} 
            onClick={() => setView('history')} 
            icon={<HistoryIcon size={20} />} 
            label="记录" 
          />
        </nav>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showApplyModal && (
          <ApplyModal 
            onClose={() => setShowApplyModal(false)} 
            fromUserId={user.id}
            toUserId={user.partner?.id || 0}
            projects={projects}
            onSuccess={() => {
              setShowApplyModal(false);
              fetchApplications();
            }}
          />
        )}
        {showRewardModal && (
          <RewardModal 
            onClose={() => setShowRewardModal(false)} 
            creatorId={user.id}
            pairId={user.pair_id!}
            onSuccess={() => {
              setShowRewardModal(false);
              fetchRewards();
            }}
          />
        )}
        {showProjectModal && (
          <ProjectModal 
            onClose={() => setShowProjectModal(false)} 
            creatorId={user.id}
            pairId={user.pair_id!}
            projects={projects}
            onSuccess={() => {
              fetchProjects();
            }}
          />
        )}
        {showWishlistModal && (
          <WishlistModal 
            onClose={() => setShowWishlistModal(false)} 
            creatorId={user.id}
            pairId={user.pair_id!}
            onSuccess={() => {
              setShowWishlistModal(false);
              fetchWishlist();
            }}
          />
        )}
        {showProfileModal && (
          <ProfileModal 
            onClose={() => setShowProfileModal(false)} 
            user={user}
            onSuccess={(newUsername) => {
              setUser(prev => prev ? { ...prev, username: newUsername } : null);
              setShowProfileModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---

function PairingView({ onJoin, onCreate }: { onJoin: (id: string) => void, onCreate: () => void }) {
  const [joinId, setJoinId] = useState('');
  return (
    <div className="max-w-md mx-auto space-y-8 py-12">
      <div className="text-center">
        <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Heart size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">开启双人旅程</h2>
        <p className="text-slate-500 mt-2">创建一个配对 ID 或加入已有的配对</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <Button onClick={onCreate} className="w-full" variant="primary" size="lg">
            创建新配对
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">或者</span></div>
          </div>
          <div className="space-y-2">
            <Input 
              value={joinId} 
              onChange={e => setJoinId(e.target.value)} 
              placeholder="输入配对 ID" 
            />
            <Button 
              onClick={() => onJoin(joinId)} 
              className="w-full" 
              variant="outline"
              disabled={!joinId}
            >
              加入配对
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function DashboardView({ user, onApply, onManageProjects }: { user: User, onApply: () => void, onManageProjects: () => void }) {
  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-8 bg-brand-700 text-white border-none relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <UserIcon size={24} className="text-brand-50" />
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold bg-white/10 px-3 py-1 rounded-full backdrop-blur-md text-brand-100">
                我的余额
              </span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-brand-200 font-serif italic">{user.username}</h3>
              <div className="text-6xl font-black tracking-tighter flex items-baseline gap-1">
                {user.points}
                <span className="text-lg font-medium text-brand-300">分</span>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                <div className="text-[10px] uppercase tracking-wider text-brand-300 font-bold">累计获得</div>
                <div className="text-sm font-bold text-brand-100">{user.total_points}</div>
              </div>
            </div>
          </div>
        </Card>

        {user.partner ? (
          <Card className="p-8 bg-white border-brand-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -mr-16 -mt-16 blur-3xl" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                  <Heart size={24} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold bg-brand-50 text-brand-600 px-3 py-1 rounded-full">
                  另一半
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-400 font-serif italic">{user.partner.username}</h3>
                <div className="text-6xl font-black tracking-tighter text-slate-900 flex items-baseline gap-1">
                  {user.partner.points}
                  <span className="text-lg font-medium text-slate-400">分</span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-50">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">累计获得</div>
                  <div className="text-sm font-bold text-slate-600">{user.partner.total_points}</div>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-8 flex flex-col items-center justify-center text-center border-dashed border-2 border-brand-200 bg-brand-50/50">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4 animate-float">
              <LinkIcon className="text-brand-400" size={32} />
            </div>
            <p className="text-lg font-serif italic text-brand-900">等待另一半加入...</p>
            <p className="text-xs text-brand-500 mt-1 max-w-[200px]">分享您的唯一配对 ID，开始你们的旅程。</p>
            <div className="mt-6 flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-brand-100 shadow-sm">
              <span className="text-sm font-mono font-bold text-brand-600">{user.pair_id}</span>
              <button onClick={() => {
                navigator.clipboard.writeText(user.pair_id!);
                alert('已复制到剪贴板');
              }} className="p-2 text-brand-300 hover:text-brand-600 transition-colors">
                <Copy size={16} />
              </button>
            </div>
          </Card>
        )}
      </div>

      {user.partner && (
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button onClick={onApply} variant="brand" size="lg" className="rounded-3xl px-10 py-5 shadow-2xl shadow-brand-200/50 text-lg font-bold">
            <Plus size={24} />
            发起积分申请
          </Button>
          <Button onClick={onManageProjects} variant="outline" size="lg" className="rounded-3xl px-10 py-5 bg-white border-brand-200 text-brand-900 hover:bg-brand-50">
            <Edit2 size={20} className="text-brand-400" />
            积分项目
          </Button>
        </div>
      )}

      <div className="pt-4">
        <h4 className="text-[10px] font-black text-brand-400 mb-6 uppercase tracking-[0.2em] text-center">快捷指南</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <GuideCard 
            icon={<Plus className="text-emerald-500" size={20} />} 
            title="申请加分" 
            desc="为对方的好行为点赞" 
          />
          <GuideCard 
            icon={<Minus className="text-rose-500" size={20} />} 
            title="申请扣分" 
            desc="提醒对方需要改进" 
          />
          <GuideCard 
            icon={<Store className="text-brand-500" size={20} />} 
            title="兑换奖励" 
            desc="用积分为自己换取福利" 
          />
        </div>
      </div>
    </div>
  );
}

function GuideCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <Card className="p-6 flex items-start gap-4 hover:border-brand-300 transition-colors group">
      <div className="mt-1 p-2 bg-slate-50 rounded-xl group-hover:bg-brand-50 transition-colors">{icon}</div>
      <div>
        <div className="text-sm font-bold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
    </Card>
  );
}

function InboxView({ applications, redemptionRequests, onRefresh }: { 
  applications: Application[], 
  redemptionRequests: RedemptionRequest[],
  onRefresh: () => void 
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState<number>(0);

  const handleRespond = async (id: number, status: 'approved' | 'rejected', points?: number) => {
    await fetch(`/api/applications/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, points }),
    });
    setEditingId(null);
    onRefresh();
  };

  const handleRespondRedemption = async (id: number, status: 'approved' | 'rejected') => {
    await fetch(`/api/redemptions/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  };

  const totalPending = applications.length + redemptionRequests.length;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-brand-900 tracking-tight">收件箱</h2>
        <span className="px-3 py-1 bg-brand-100 text-brand-700 text-[10px] font-black uppercase tracking-widest rounded-full">
          {totalPending} 待处理
        </span>
      </div>

      {totalPending === 0 ? (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-brand-100 card-shadow">
          <div className="w-20 h-20 bg-brand-50 text-brand-200 rounded-full flex items-center justify-center mx-auto mb-4 animate-float">
            <Inbox size={40} />
          </div>
          <p className="text-brand-900 font-serif italic text-lg">暂无待处理的申请</p>
          <p className="text-brand-400 text-sm mt-1">你的收件箱很干净</p>
        </div>
      ) : (
        <div className="space-y-8">
          {applications.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">积分申请</h3>
              {applications.map(app => (
                <motion.div key={`app-${app.id}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="p-6 border-brand-100 rounded-3xl">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">来自 {app.from_username}</div>
                        <h3 className="text-xl font-bold text-slate-900">{app.title}</h3>
                      </div>
                      <div className={cn(
                        "text-3xl font-black tracking-tighter",
                        app.points > 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {app.points > 0 ? `+${app.points}` : app.points}
                      </div>
                    </div>
                    
                    {app.description && (
                      <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-2xl mb-6 italic leading-relaxed">
                        "{app.description}"
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      {editingId === app.id ? (
                        <div className="flex items-center gap-3 w-full bg-brand-50 p-3 rounded-2xl border border-brand-100">
                          <Input 
                            type="number" 
                            value={editPoints} 
                            onChange={e => setEditPoints(Number(e.target.value))}
                            className="w-24 bg-white"
                          />
                          <Button onClick={() => handleRespond(app.id, 'approved', editPoints)} variant="brand" size="sm" className="flex-grow rounded-xl">
                            确认修改
                          </Button>
                          <Button onClick={() => setEditingId(null)} variant="ghost" size="sm" className="rounded-xl">
                            取消
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button onClick={() => handleRespond(app.id, 'approved')} variant="brand" className="flex-grow rounded-2xl py-3 font-bold">
                            <Check size={18} /> 同意
                          </Button>
                          <Button onClick={() => {
                            setEditingId(app.id);
                            setEditPoints(app.points);
                          }} variant="outline" className="flex-grow rounded-2xl py-3 border-brand-200 text-brand-600 font-bold">
                            <Edit2 size={18} /> 修改
                          </Button>
                          <Button onClick={() => handleRespond(app.id, 'rejected')} variant="ghost" className="px-4 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-2xl font-bold">
                            拒绝
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {redemptionRequests.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-brand-400 uppercase tracking-[0.2em]">兑换请求</h3>
              {redemptionRequests.map(req => (
                <motion.div key={`red-${req.id}`} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className="p-6 border-brand-100 rounded-3xl">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">来自 {req.from_username} 的兑换申请</div>
                        <h3 className="text-xl font-bold text-slate-900">{req.title}</h3>
                      </div>
                      <div className="text-3xl font-black tracking-tighter text-brand-600">
                        -{req.points_spent}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => handleRespondRedemption(req.id, 'approved')} variant="brand" className="flex-grow rounded-2xl py-3 font-bold">
                        <Check size={18} /> 同意兑换
                      </Button>
                      <Button onClick={() => handleRespondRedemption(req.id, 'rejected')} variant="outline" className="flex-grow rounded-2xl py-3 border-brand-200 text-brand-600 font-bold">
                        拒绝
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoreView({ rewards, userPoints, myPendingRedemptions, onAddReward, onRefresh, pairId, userId }: { 
  rewards: Reward[], 
  userPoints: number, 
  myPendingRedemptions: number[],
  onAddReward: () => void,
  onRefresh: () => void,
  pairId: string,
  userId: number
}) {
  const handleRedeem = async (id: number) => {
    const res = await fetch(`/api/rewards/${id}/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      alert('兑换申请已发送，请等待对方同意！');
      onRefresh();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleRemind = async (id: number) => {
    const res = await fetch(`/api/rewards/${id}/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      alert('已提醒对方！');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该奖励吗？')) return;
    const res = await fetch(`/api/rewards/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      onRefresh();
    }
  };

  const handleCancelRedeem = async (rewardId: number) => {
    if (!confirm('确定取消该兑换申请吗？')) return;
    const res = await fetch(`/api/redemptions/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, rewardId }),
    });
    if (res.ok) {
      onRefresh();
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-brand-900 tracking-tight">奖励商店</h2>
        <Button onClick={onAddReward} variant="brand" size="sm" className="rounded-2xl">
          <Plus size={16} /> 添加奖励
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {rewards.map(reward => (
          <Card key={reward.id} className="p-6 flex flex-col relative group hover:border-brand-300 transition-all">
            <button 
              onClick={() => handleDelete(reward.id)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-600 transition-all bg-slate-50 rounded-xl"
            >
              <Trash2 size={16} />
            </button>
            <div className="flex justify-between items-start mb-4 pr-10">
              <div>
                <h3 className="font-bold text-lg text-slate-900 leading-tight">{reward.title}</h3>
                {reward.expected_date && (
                  <div className="text-[10px] text-brand-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                    期待日期: {reward.expected_date}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-brand-600 font-black text-xl">
                <Sparkles size={18} />
                {reward.points_required}
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-6 flex-grow leading-relaxed">{reward.description || '暂无描述'}</p>
            
            {myPendingRedemptions.includes(reward.id) ? (
              <div className="space-y-3">
                <div className="w-full py-3 px-4 rounded-2xl border border-amber-200 text-amber-700 bg-amber-50 text-center text-sm font-bold flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  等待对方确认...
                </div>
                <button 
                  onClick={() => handleCancelRedeem(reward.id)}
                  className="w-full text-xs text-slate-400 hover:text-rose-600 transition-colors font-bold uppercase tracking-widest"
                >
                  取消申请
                </button>
              </div>
            ) : userPoints >= reward.points_required ? (
              <Button 
                onClick={() => handleRedeem(reward.id)} 
                variant="brand"
                className="w-full rounded-2xl py-4 font-bold"
              >
                立即兑换
              </Button>
            ) : (
              <Button 
                onClick={() => handleRemind(reward.id)} 
                variant="outline"
                className="w-full rounded-2xl py-4 border-brand-200 text-brand-600 hover:bg-brand-50 font-bold"
              >
                提醒对方 (还差 {reward.points_required - userPoints} 分)
              </Button>
            )}
          </Card>
        ))}
      </div>

      {rewards.length === 0 && (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-brand-100 card-shadow">
          <Store size={48} className="mx-auto text-brand-200 mb-4 animate-float" />
          <p className="text-brand-900 font-serif italic text-lg">商店空空如也</p>
          <p className="text-brand-400 text-sm mt-1">快去为彼此添加一些心动的奖励吧</p>
        </div>
      )}
    </div>
  );
}

function HistoryView({ history, onRefresh }: { history: HistoryItem[], onRefresh: () => void }) {
  const handleDelete = async (item: HistoryItem) => {
    if (!confirm('确定删除这条记录吗？')) return;
    const endpoint = item.type === 'application' ? `/api/applications/${item.id}` : `/api/redemptions/${item.id}`;
    const res = await fetch(endpoint, { method: 'DELETE' });
    if (res.ok) {
      onRefresh();
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <h2 className="text-3xl font-black text-brand-900 tracking-tight">历史记录</h2>
      
      <div className="space-y-4">
        {history.map((item, i) => (
          <Card key={i} className="p-6 flex gap-4 items-start group hover:border-brand-200 transition-all rounded-3xl">
            <div className="mt-1">
              <div className={cn(
                "w-3 h-3 rounded-full shadow-sm",
                item.type === 'application' ? (item.points > 0 ? "bg-emerald-500" : "bg-rose-500") : "bg-brand-500"
              )} />
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <div className="text-base font-bold text-slate-900">{item.title}</div>
                  <div className="text-xs text-slate-400 mt-1 font-medium">
                    {item.type === 'application' ? (
                      <span>{item.from_user} 为 {item.to_user} 申请 · {item.status === 'approved' ? '已同意' : '已驳回'}</span>
                    ) : (
                      <span>{item.from_user} 申请兑换 · {item.status === 'approved' ? '已同意' : '已驳回'}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={cn(
                      "text-lg font-black tracking-tighter",
                      item.type === 'application' ? (item.points > 0 ? "text-emerald-600" : "text-rose-600") : "text-brand-600"
                    )}>
                      {item.type === 'application' ? (item.points > 0 ? `+${item.points}` : item.points) : `-${item.points}`}
                    </div>
                    <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                      {format(new Date(item.created_at), 'MM-dd HH:mm')}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(item)}
                    className="p-2 text-slate-200 hover:text-rose-600 transition-all bg-slate-50 rounded-xl"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {history.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-brand-100 card-shadow">
            <HistoryIcon size={48} className="mx-auto text-brand-200 mb-4 animate-float" />
            <p className="text-brand-900 font-serif italic text-lg">暂无记录</p>
            <p className="text-brand-400 text-sm mt-1">开始你们的积分之旅吧</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WishlistView({ wishlist, onAddWish, onRefresh, userId }: {
  wishlist: WishlistItem[],
  onAddWish: () => void,
  onRefresh: () => void,
  userId: number
}) {
  const handleToggle = async (id: number) => {
    await fetch(`/api/wishlist/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这个心愿吗？')) return;
    await fetch(`/api/wishlist/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-brand-900 tracking-tight">心愿清单</h2>
        <Button onClick={onAddWish} variant="brand" size="sm" className="rounded-2xl">
          <Plus size={16} /> 许愿
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {wishlist.map(item => (
          <Card key={item.id} className={cn(
            "p-6 flex flex-col relative group transition-all",
            item.is_completed ? "bg-slate-50 opacity-70" : "hover:border-brand-300"
          )}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex-grow pr-10">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={cn(
                    "font-bold text-lg text-slate-900 leading-tight",
                    item.is_completed && "line-through text-slate-400"
                  )}>{item.title}</h3>
                </div>
                <div className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">
                  by {item.creator_name} · {format(new Date(item.created_at), 'yyyy-MM-dd')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleToggle(item.id)}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    item.is_completed ? "bg-brand-100 text-brand-600" : "bg-slate-50 text-slate-300 hover:text-brand-600"
                  )}
                >
                  <Check size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 transition-all bg-slate-50 rounded-xl"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {item.description && (
              <p className={cn(
                "text-sm text-slate-500 leading-relaxed",
                item.is_completed && "line-through"
              )}>{item.description}</p>
            )}
          </Card>
        ))}
      </div>

      {wishlist.length === 0 && (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-brand-100 card-shadow">
          <Star size={48} className="mx-auto text-brand-200 mb-4 animate-float" />
          <p className="text-brand-900 font-serif italic text-lg">心愿清单空空的</p>
          <p className="text-brand-400 text-sm mt-1">写下想和 TA 一起完成的小惊喜吧</p>
        </div>
      )}
    </div>
  );
}

// --- Modals ---

function ApplyModal({ onClose, fromUserId, toUserId, projects, onSuccess }: { 
  onClose: () => void, 
  fromUserId: number, 
  toUserId: number,
  projects: PointProject[],
  onSuccess: () => void 
}) {
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState(1);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectProject = (project: PointProject) => {
    setTitle(project.title);
    setPoints(project.default_points);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId, toUserId, title, points, description }),
      });
      if (res.ok) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-slate-900">发起积分申请</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-6">
          {projects.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">快捷选择项目</label>
              <div className="flex flex-wrap gap-2">
                {projects.map(p => (
                  <button 
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProject(p)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:border-brand-200 transition-all"
                  >
                    {p.title} ({p.default_points > 0 ? `+${p.default_points}` : p.default_points})
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：洗碗、早起、乱丢垃圾" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分值 (正数为加分，负数为扣分)</label>
              <Input type="number" value={points} onChange={e => setPoints(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">描述 (可选)</label>
              <textarea 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all min-h-[100px]"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="添加一些细节..."
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '发送中...' : '发送申请'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function ProjectModal({ onClose, creatorId, pairId, projects, onSuccess }: { 
  onClose: () => void, 
  creatorId: number, 
  pairId: string,
  projects: PointProject[],
  onSuccess: () => void 
}) {
  const [title, setTitle] = useState('');
  const [defaultPoints, setDefaultPoints] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/point-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, pairId, title, defaultPoints }),
      });
      if (res.ok) {
        setTitle('');
        setDefaultPoints(1);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该项目吗？')) return;
    await fetch(`/api/point-projects/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: creatorId }),
    });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-slate-900">积分项目</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <div className="overflow-y-auto p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <h4 className="text-sm font-bold text-slate-900">添加新项目</h4>
            <div className="grid grid-cols-1 gap-3">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="项目名称 (如: 洗碗)" required />
              <Input type="number" value={defaultPoints} onChange={e => setDefaultPoints(Number(e.target.value))} placeholder="默认分值" required />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '保存中...' : '添加'}
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">现有项目</h4>
            {projects.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无项目</p>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div>
                      <div className="font-bold text-slate-900">{p.title}</div>
                      <div className={cn("text-xs font-medium", p.default_points > 0 ? "text-emerald-600" : "text-rose-600")}>
                        默认: {p.default_points > 0 ? `+${p.default_points}` : p.default_points}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RewardModal({ onClose, creatorId, pairId, onSuccess }: { 
  onClose: () => void, 
  creatorId: number, 
  pairId: string,
  onSuccess: () => void 
}) {
  const [title, setTitle] = useState('');
  const [pointsRequired, setPointsRequired] = useState(10);
  const [description, setDescription] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, pairId, title, pointsRequired, description, expectedDate }),
      });
      if (res.ok) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900">添加奖励项目</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">奖励名称</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：一杯奶茶、看一场电影" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">所需积分</label>
            <Input type="number" value={pointsRequired} onChange={e => setPointsRequired(Number(e.target.value))} required min={1} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">期待兑换日期 (可选)</label>
            <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述 (可选)</label>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all min-h-[100px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述一下奖励内容..."
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '保存中...' : '添加奖励'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

function WishlistModal({ onClose, creatorId, pairId, onSuccess }: {
  onClose: () => void,
  creatorId: number,
  pairId: string,
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, pairId, title, description }),
      });
      if (res.ok) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900">写下一个心愿</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">心愿标题</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：去海边看日出、一起吃超辣火锅" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述 (可选)</label>
            <textarea 
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all min-h-[100px]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="想怎么实现这个心愿呢？"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '许愿中...' : '发布心愿'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

function ProfileModal({ onClose, user, onSuccess }: { 
  onClose: () => void, 
  user: User,
  onSuccess: (username: string) => void 
}) {
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: password || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(username);
      } else {
        setError(data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-900">修改个人资料</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
            <Input value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">新密码 (留空则不修改)</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入新密码" />
          </div>
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '保存中...' : '保存修改'}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

// --- Helpers ---

function NavButton({ active, onClick, icon, label, badge }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  badge?: number
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all relative",
        active ? "text-brand-900 scale-110" : "text-slate-400 hover:text-brand-600"
      )}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black">
            {badge}
          </span>
        )}
      </div>
      <span className={cn("text-[10px] font-black uppercase tracking-widest transition-opacity", active ? "opacity-100" : "opacity-0")}>{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-dot"
          className="absolute -bottom-2 w-1 h-1 bg-brand-900 rounded-full"
        />
      )}
    </button>
  );
}
