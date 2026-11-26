import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  MessageSquare, Send, ArrowLeft, Search, AlertCircle, RefreshCw 
} from 'lucide-react';
import { chatApi } from '../../../api/services';
import { useAuth } from '../../../contexts/AuthContext';
import type { Conversation, Message } from '../../../types';
import { useStatusBar } from '../../hooks/useStatusBar';

export const MobileMessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useStatusBar(false);

  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversations list
  const { 
    data: conversations, 
    isLoading: isConvsLoading, 
    isError: isConvsError, 
    refetch: refetchConvs 
  } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: chatApi.getConversations,
    refetchInterval: 6000,
  });

  // Active messages
  const { data: messagesData, isLoading: isMessagesLoading } = useQuery({
    queryKey: ['chat-messages', activeConversation?.id],
    queryFn: () => activeConversation ? chatApi.getMessages(activeConversation.id, 1, 100) : null,
    enabled: !!activeConversation,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ convId, text }: { convId: string; text: string }) =>
      chatApi.sendMessage(convId, text),
    onSuccess: () => {
      setInputText('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });

  useEffect(() => {
    if (activeConversation) {
      chatApi.markAsRead(activeConversation.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] });
    }
  }, [activeConversation, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || sendMutation.isPending) return;
    sendMutation.mutate({ convId: activeConversation.id, text: inputText.trim() });
  };

  const getOtherName = (conv: Conversation) => {
    if (user?.role === 'WORKER') {
      return conv.employer?.organization_name || conv.employer?.full_name || 'Employer';
    }
    return conv.worker?.full_name || 'Worker';
  };

  const convList = (conversations || []).filter((c) => {
    const name = getOtherName(c);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Active Chat Detail View
  if (activeConversation) {
    const otherName = getOtherName(activeConversation);
    const messages = messagesData?.items || [];

    return (
      <div className="mobile-app-root justify-between h-screen h-[100dvh]">
        {/* Chat Header */}
        <div className="mobile-header-safe">
          <div className="flex h-14 items-center gap-3 px-3">
            <button
              type="button"
              onClick={() => setActiveConversation(null)}
              className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-900 text-white font-bold text-xs shadow-sm">
              {otherName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm text-slate-900 truncate">{otherName}</h2>
              <span className="text-[10px] text-slate-500 font-medium">Direct Chat</span>
            </div>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isMessagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-10 w-2/3 rounded-2xl mobile-skeleton" />
              ))}
            </div>
          ) : messages.length > 0 ? (
            messages.map((msg: Message) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs font-medium shadow-sm leading-relaxed ${
                      isMine
                        ? 'bg-indigo-900 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
              <MessageSquare className="h-10 w-10 mb-2 stroke-[1.5]" />
              <p>Say hello to start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar with Keyboard Safe Area */}
        <div className="border-t border-slate-200 bg-white p-3 mobile-nav-safe">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium focus:bg-white focus:border-indigo-900 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sendMutation.isPending}
              className="mobile-touch-target rounded-full bg-indigo-900 p-2 text-white shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Conversation List View
  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{t('nav.messages', 'Messages')}</h1>
        <p className="text-xs text-slate-500">Communicate directly with workers or employers</p>
      </div>

      {/* Search Conversations */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-medium shadow-sm focus:border-indigo-900 focus:outline-none"
        />
      </div>

      {/* List */}
      {isConvsLoading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-2xl mobile-skeleton" />
          ))}
        </div>
      ) : isConvsError ? (
        <div className="rounded-2xl bg-white p-6 text-center border border-red-100 shadow-sm mt-4">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">Failed to load conversations</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetchConvs()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : convList.length > 0 ? (
        <div className="space-y-2">
          {convList.map((conv) => {
            const otherName = getOtherName(conv);
            const hasUnread = (conv.unread_count || 0) > 0;
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className={`mobile-card p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform ${
                  hasUnread ? 'border-indigo-200 bg-indigo-50/20' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-900 text-white font-bold text-sm shadow-sm flex-shrink-0">
                    {otherName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-xs truncate ${hasUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-800'}`}>
                        {otherName}
                      </h3>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${hasUnread ? 'font-semibold text-indigo-900' : 'text-slate-500'}`}>
                      {conv.last_message?.content || 'No messages yet'}
                    </p>
                  </div>
                </div>

                {hasUnread && (
                  <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold text-white">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">No Messages</h3>
          <p className="text-xs text-slate-500 mt-1">Direct messages about job applications and shifts will appear here.</p>
        </div>
      )}
    </div>
  );
};

export default MobileMessagesPage;
