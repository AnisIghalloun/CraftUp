import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  Star, 
  Plus, 
  Trash2, 
  Edit3, 
  LogOut, 
  Shield, 
  User as UserIcon,
  Image as ImageIcon,
  Volume2,
  Loader2,
  X,
  ChevronRight,
  Info,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Mod, User } from './types';
import { searchModInfo, analyzeScreenshot, generateTTS } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-900/20',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
    outline: 'bg-transparent border border-emerald-600 text-emerald-500 hover:bg-emerald-600/10',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800',
    gold: 'bg-amber-500 text-zinc-950 hover:bg-amber-600 font-bold shadow-amber-900/20'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-lg',
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

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl', className)}>
    {children}
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-bottom border-zinc-800 bg-zinc-950/50">
            <h3 className="text-lg font-bold text-emerald-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {title}
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
          <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState<Mod | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  useEffect(() => {
    fetchMe();
    fetchMods();
  }, []);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      setUser(data.user);
      setIsAdmin(data.isAdmin);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMods = async () => {
    try {
      const res = await fetch('/api/mods');
      const data = await res.json();
      setMods(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          fetchMe();
          setIsLoginModalOpen(false);
          window.removeEventListener('message', handleMessage);
        }
      };
      window.addEventListener('message', handleMessage);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (res.ok) {
        setIsAdmin(true);
        setIsAdminLoginModalOpen(false);
        setAdminPassword('');
      } else {
        alert('Invalid password');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setIsAdmin(false);
  };

  const handleRate = async (modId: number, score: number) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/mods/${modId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
      if (res.ok) {
        fetchMods();
        if (selectedMod?.id === modId) {
          const updated = await fetch(`/api/mods/${modId}`).then(r => r.json());
          setSelectedMod(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMod = async (id: number) => {
    if (!confirm('Are you sure you want to delete this mod?')) return;
    try {
      const res = await fetch(`/api/mods/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMods();
        setSelectedMod(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMods = mods.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedMod(null); setIsAdminPanelOpen(false); }}>
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">
              MineMod<span className="text-emerald-500">Hub</span>
            </h1>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search mods..." 
                className="w-full bg-zinc-800 border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 border outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="gold" size="sm" onClick={() => setIsAdminPanelOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Mod
              </Button>
            )}
            
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-800 rounded-full pl-1 pr-3 py-1 border border-zinc-700">
                  <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  <span className="text-xs font-medium text-zinc-300">{user.name}</span>
                </div>
                <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setIsLoginModalOpen(true)}>
                <UserIcon className="w-4 h-4 mr-1" />
                Login
              </Button>
            )}

            {!isAdmin && (
              <button 
                onClick={() => setIsAdminLoginModalOpen(true)}
                className="p-2 text-zinc-500 hover:text-amber-500 transition-colors"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isAdminPanelOpen ? (
          <AdminPanel 
            onClose={() => { setIsAdminPanelOpen(false); setIsEditing(null); }} 
            onSuccess={() => { fetchMods(); setIsAdminPanelOpen(false); setIsEditing(null); }}
            editingMod={isEditing}
          />
        ) : selectedMod ? (
          <ModDetails 
            mod={selectedMod} 
            onBack={() => setSelectedMod(null)} 
            onRate={handleRate}
            isAdmin={isAdmin}
            onDelete={handleDeleteMod}
            onEdit={(mod) => { setIsEditing(mod); setIsAdminPanelOpen(true); }}
          />
        ) : (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-800 p-8 md:p-12">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-600/10 to-transparent pointer-events-none" />
              <div className="relative z-10 max-w-2xl">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest mb-4">
                  Premium Repository
                </span>
                <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
                  Elevate Your <span className="text-emerald-500">Minecraft</span> Experience.
                </h2>
                <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                  Discover, rate, and download the finest community-crafted modifications. Secure, fast, and curated for the ultimate gameplay.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button variant="primary" size="lg" onClick={() => {}}>
                    Explore Mods
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                  <div className="flex items-center gap-6 px-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{mods.length}</div>
                      <div className="text-xs text-zinc-500 uppercase font-bold">Mods</div>
                    </div>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">4.9</div>
                      <div className="text-xs text-zinc-500 uppercase font-bold">Avg Rating</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mod Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredMods.map(mod => (
                <ModCard key={mod.id} mod={mod} onClick={() => setSelectedMod(mod)} />
              ))}
            </div>
            
            {filteredMods.length === 0 && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-zinc-700" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No mods found</h3>
                <p className="text-zinc-500">Try adjusting your search or check back later.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <Modal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} title="Login Required">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <UserIcon className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-xl font-bold text-white mb-2">Connect with Google</h4>
            <p className="text-zinc-400">Join the community to rate mods and track your downloads.</p>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={handleGoogleLogin}>
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4 mr-2" alt="Google" />
            Sign in with Google
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isAdminLoginModalOpen} onClose={() => setIsAdminLoginModalOpen(false)} title="Admin Access">
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Enter the administrative password to unlock management features.</p>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Password</label>
            <input 
              type="password" 
              className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-amber-500 border"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
              placeholder="••••••••"
            />
          </div>
          <Button variant="gold" className="w-full py-3" onClick={handleAdminLogin}>
            Authenticate
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// --- Sub-components ---

function ModCard({ mod, onClick }: { mod: Mod; onClick: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="group cursor-pointer bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all shadow-lg"
    >
      <div className="aspect-video relative overflow-hidden bg-zinc-800">
        <img 
          src={mod.icon_url || 'https://picsum.photos/seed/minecraft/400/225'} 
          alt={mod.title} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-600 text-[10px] font-black text-white uppercase tracking-wider">
            {mod.size}
          </span>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-amber-400">
            <Star className="w-3 h-3 fill-current" />
            {mod.rating.toFixed(1)}
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors line-clamp-1">{mod.title}</h3>
        <p className="text-zinc-500 text-xs line-clamp-2 mb-4 leading-relaxed">{mod.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
              {mod.author_name?.[0] || 'U'}
            </div>
            <span className="text-[10px] font-medium text-zinc-400">{mod.author_name || 'Anonymous'}</span>
          </div>
          <Download className="w-4 h-4 text-zinc-600 group-hover:text-emerald-500 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}

function ModDetails({ mod, onBack, onRate, isAdmin, onDelete, onEdit }: { 
  mod: Mod; 
  onBack: () => void; 
  onRate: (id: number, score: number) => void;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onEdit: (mod: Mod) => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTTS = async () => {
    setIsGeneratingAudio(true);
    const url = await generateTTS(mod.description);
    setAudioUrl(url);
    setIsGeneratingAudio(false);
    if (url) {
      const audio = new Audio(url);
      audio.play();
    }
  };

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeScreenshot(base64, blob.type);
        setAnalysis(result);
        setIsAnalyzing(false);
      };
    } catch (e) {
      console.error(e);
      setIsAnalyzing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
          Back to repository
        </Button>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(mod)}>
              <Edit3 className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(mod.id)}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Info */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <img 
              src={mod.icon_url || 'https://picsum.photos/seed/minecraft/200/200'} 
              alt={mod.title} 
              className="w-32 h-32 rounded-2xl object-cover border-2 border-zinc-800 shadow-2xl"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-4xl font-black text-white mb-2">{mod.title}</h2>
                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-4 h-4" />
                    {mod.author_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    {mod.size}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-4 h-4 fill-current" />
                    {mod.rating.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" size="lg" className="flex-1 md:flex-none">
                  <Download className="w-5 h-5 mr-2" />
                  Download Now
                </Button>
                <Button variant="secondary" size="lg" onClick={handleTTS} disabled={isGeneratingAudio}>
                  {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Description
            </h3>
            <div className="prose prose-invert max-w-none text-zinc-400 leading-relaxed">
              <ReactMarkdown>{mod.description}</ReactMarkdown>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Screenshots
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mod.screenshots?.map((url, i) => (
                <div key={i} className="group relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  <img src={url} alt={`Screenshot ${i+1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" size="sm" onClick={() => handleAnalyze(url)}>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Analyze with AI
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Rate this mod</h4>
            <div className="flex items-center justify-between mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
                  onClick={() => onRate(mod.id, star)}
                  className="p-1 hover:scale-125 transition-transform"
                >
                  <Star className={cn("w-8 h-8", star <= Math.round(mod.rating) ? "text-amber-400 fill-current" : "text-zinc-700")} />
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 text-center">Your rating helps others discover great content.</p>
          </Card>

          {isAnalyzing || analysis ? (
            <Card className="p-6 space-y-4 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-widest">AI Analysis</h4>
                {isAnalyzing && <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />}
              </div>
              {analysis && (
                <div className="text-xs text-zinc-300 leading-relaxed italic">
                  "{analysis}"
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-6 bg-zinc-900/50 border-dashed border-zinc-800">
              <div className="text-center space-y-2">
                <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-500">Click "Analyze with AI" on a screenshot to get detailed insights.</p>
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-4">
            <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Mod Info</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Version</span>
                <span className="text-zinc-300 font-medium">1.20.1-v2</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Size</span>
                <span className="text-zinc-300 font-medium">{mod.size}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Downloads</span>
                <span className="text-zinc-300 font-medium">12.4k</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-300 font-medium">{new Date(mod.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

function AdminPanel({ onClose, onSuccess, editingMod }: { onClose: () => void; onSuccess: () => void; editingMod: Mod | null }) {
  const [formData, setFormData] = useState({
    title: editingMod?.title || '',
    description: editingMod?.description || '',
    icon_url: editingMod?.icon_url || '',
    size: editingMod?.size || '',
    screenshots: editingMod?.screenshots?.join('\n') || ''
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearchInfo = async () => {
    if (!formData.title) return;
    setIsSearching(true);
    const info = await searchModInfo(formData.title);
    if (info) {
      setFormData(prev => ({ ...prev, description: info }));
    }
    setIsSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const method = editingMod ? 'PUT' : 'POST';
      const url = editingMod ? `/api/mods/${editingMod.id}` : '/api/mods';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          screenshots: formData.screenshots.split('\n').filter(s => s.trim())
        })
      });
      
      if (res.ok) {
        onSuccess();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-black text-white">{editingMod ? 'Edit Mod' : 'Add New Mod'}</h2>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">Mod Title</label>
            <div className="flex gap-2">
              <input 
                required
                className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 border"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Better Minecraft"
              />
              <Button type="button" variant="secondary" onClick={handleSearchInfo} disabled={isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase">File Size</label>
            <input 
              required
              className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 border"
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              placeholder="e.g. 24.5 MB"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase">Icon URL</label>
          <input 
            className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 border"
            value={formData.icon_url}
            onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase">Description (Markdown Supported)</label>
          <textarea 
            required
            rows={6}
            className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 border resize-none"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the mod features..."
          />
          <p className="text-[10px] text-zinc-600 italic">Tip: Use the search button next to title to auto-generate description using AI.</p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase">Screenshot URLs (One per line)</label>
          <textarea 
            rows={4}
            className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-emerald-500 border resize-none"
            value={formData.screenshots}
            onChange={(e) => setFormData({ ...formData, screenshots: e.target.value })}
            placeholder="https://...&#10;https://..."
          />
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Shield className="w-5 h-5 mr-2" />}
          {editingMod ? 'Update Mod' : 'Publish Mod'}
        </Button>
      </form>
    </div>
  );
}
