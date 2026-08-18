import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  Settings2,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { chatApi } from '../api/endpoints';
import { useTheme } from '../theme/ThemeContext';
import { ChatListContext } from '../chat/ChatContext';

const SIDEBAR_EXPANDED = 264;
const SIDEBAR_RAIL = 64;

const workspaceItems = [
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-bases', label: 'Knowledge Bases', icon: Database },
  { to: '/settings', label: 'Settings', icon: Settings2 },
  { to: '/admin', label: 'Admin', icon: Shield, adminOnly: true },
];

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(() => {
    try {
      return localStorage.getItem('ka-sidebar-expanded') !== 'false';
    } catch {
      return true;
    }
  });
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const expanded = isMobile ? mobileOpen : isTablet ? manualExpanded : true;

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    try {
      localStorage.setItem('ka-sidebar-expanded', String(manualExpanded));
    } catch {
      /* private mode */
    }
  }, [manualExpanded]);

  const refreshChats = useCallback(async () => {
    try {
      setChats(await chatApi.list());
    } catch {
      /* interceptor handles auth */
    }
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const selectChat = (id) => {
    setActiveChatId(id);
    setMobileOpen(false);
  };

  const newChat = () => {
    setActiveChatId(null);
    setMobileOpen(false);
  };

  const deleteChat = async (e, chat) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${chat.title}"?`)) return;
    try {
      await chatApi.remove(chat.id);
      if (activeChatId === chat.id) setActiveChatId(null);
      await refreshChats();
    } catch {
      /* ignore */
    }
  };

  const toggleSidebar = () => {
    if (isMobile) setMobileOpen((o) => !o);
    else setManualExpanded((e) => !e);
  };

  const sidebarClasses = expanded ? 'w-[264px]' : 'w-16';

  const sidebar = (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 ${
        isMobile ? 'fixed inset-y-0 left-0 z-50 shadow-xl' : 'relative'
      } ${sidebarClasses}`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-slate-100 px-3 dark:border-slate-800">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Sparkles size={16} />
        </div>
        {expanded && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                Knowledge Assistant
              </p>
              <p className="text-[10px] text-slate-400">Enterprise RAG</p>
            </div>
            <button onClick={toggleSidebar} className="icon-btn" title="Collapse sidebar">
              <ChevronLeft size={16} />
            </button>
            {isMobile && (
              <button onClick={() => setMobileOpen(false)} className="icon-btn" title="Close">
                <X size={16} />
              </button>
            )}
          </>
        )}
        {!expanded && (
          <button onClick={toggleSidebar} className="icon-btn mx-auto" title="Expand sidebar">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <button
          onClick={newChat}
          className={`mb-2 flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-sm font-medium text-white shadow-sm transition hover:opacity-90 ${
            expanded ? 'w-full px-3 py-2.5' : 'mx-auto p-2'
          }`}
          title="New chat"
        >
          <Plus size={16} className="shrink-0" />
          {expanded && <span>New chat</span>}
        </button>

        {expanded && (
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Chats
          </p>
        )}
        <div className="space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => selectChat(chat.id)}
              title={chat.title}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                activeChatId === chat.id
                  ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
              }`}
            >
              <MessageSquare size={14} className="shrink-0 opacity-60" />
              {expanded && (
                <>
                  <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                  <button
                    onClick={(e) => deleteChat(e, chat)}
                    className="hidden shrink-0 text-slate-400 hover:text-red-500 group-hover:block"
                    title="Delete chat"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
          {expanded && chats.length === 0 && (
            <p className="px-3 py-1 text-xs text-slate-400">No chats yet</p>
          )}
        </div>

        {expanded && (
          <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Workspace
          </p>
        )}
        <div className="space-y-0.5">
          {workspaceItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                    expanded ? '' : 'justify-center'
                  } ${
                    isActive
                      ? 'bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <item.icon size={16} className="shrink-0 opacity-70" />
                {expanded && <span>{item.label}</span>}
              </NavLink>
            ))}
        </div>
      </div>

      <div
        className={`border-t border-slate-100 p-2 dark:border-slate-800 ${
          expanded ? 'space-y-1' : 'flex flex-col items-center gap-1'
        }`}
      >
        {expanded && (
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-xs font-semibold text-white">
              {initials(user?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                {user?.full_name}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
        )}
        {!expanded && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 text-xs font-semibold text-white">
            {initials(user?.full_name)}
          </div>
        )}
        <button onClick={toggle} className={expanded ? 'icon-btn w-full justify-start gap-2 text-sm' : 'icon-btn'} title="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {expanded && <span className="text-sm font-normal">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button onClick={handleLogout} className={expanded ? 'icon-btn w-full justify-start gap-2 text-sm' : 'icon-btn'} title="Sign out">
          <LogOut size={16} />
          {expanded && <span className="text-sm font-normal">Sign out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <ChatListContext.Provider
      value={{ chats, activeChatId, selectChat, newChat, refreshChats }}
    >
      <div className="flex h-screen overflow-hidden">
        <div className="hidden md:block">
          <div className="h-full">{sidebar}</div>
        </div>
        {isMobile && mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            {sidebar}
          </>
        )}
        <main className="relative flex-1 overflow-hidden">
          <div className="flex h-14 items-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <button onClick={toggleSidebar} className="icon-btn" title="Menu">
              <Menu size={20} />
            </button>
            <div className="ml-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Sparkles size={14} />
              </div>
              <span className="text-sm font-semibold">Knowledge Assistant</span>
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </ChatListContext.Provider>
  );
}