import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, ArrowLeft, Search, AlertCircle, RefreshCw,
  Check, CheckCheck, Lock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { chatApi } from '../../../api/services';
import { extractErrorMessage } from '../../../api/client';
import { useAuth } from '../../../contexts/AuthContext';
import type { Conversation, Message } from '../../../types';
import { useAdaptivePollInterval } from '../../sync/useMobileSync';
import { MOBILE_QUERY_KEYS } from '../../sync/queryKeys';
import MobilePageHeader from '../../components/ui/MobilePageHeader';
import MobileStatusBadge from '../../components/ui/MobileStatusBadge';

export const MobileMessagesPage: React.FC = () => {
  const { t } = useTranslation(['translation', 'mobile']);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConvId = searchParams.get('conversation');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [failedText, setFailedText] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');

  const convPollMs = useAdaptivePollInterval(5000, { enabled: !!user });
  const msgPollMs = useAdaptivePollInterval(3000, { enabled: !!user && !!selectedConvId });

  const {
    data: conversations = [],
    isLoading: isConvsLoading,
    isError: isConvsError,
    refetch: refetchConvs,
  } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.chatConversations,
    queryFn: chatApi.getConversations,
    refetchInterval: convPollMs,
    staleTime: 2500,
    enabled: !!user,
  });

  const activeConversation = conversations.find((c) => c.id === selectedConvId) || null;

  const {
    data: messagesData,
    isLoading: isMessagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: MOBILE_QUERY_KEYS.chatMessages(selectedConvId || ''),
    queryFn: () => chatApi.getMessages(selectedConvId!, 1, 50),
    enabled: !!selectedConvId,
    refetchInterval: msgPollMs,
    staleTime: 1500,
  });

  const sendMutation = useMutation({
    mutationFn: ({ convId, text }: { convId: string; text: string }) =>
      chatApi.sendMessage(convId, text),
    onSuccess: () => {
      setInputText('');
      setFailedText(null);
      setSendError('');
      if (selectedConvId) {
        void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatMessages(selectedConvId) });
      }
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatConversations });
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatUnreadCount });
    },
    onError: (err, vars) => {
      setFailedText(vars.text);
      setSendError(extractErrorMessage(err));
    },
  });

  // Mark as read on open and whenever new unread incoming messages arrive
  const messagesList = messagesData?.items || [];
  const hasUnreadIncoming = messagesList.some((m) => m.sender_id !== user?.id && !m.is_read);

  useEffect(() => {
    if (selectedConvId && (hasUnreadIncoming || (activeConversation && activeConversation.unread_count > 0))) {
      chatApi
        .markAsRead(selectedConvId)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatUnreadCount });
          void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatConversations });
        })
        .catch(() => {});
    }
  }, [selectedConvId, hasUnreadIncoming, activeConversation?.unread_count, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesList.length, selectedConvId]);

  const openConversation = (convId: string) => {
    setSearchParams({ conversation: convId });
  };

  const closeConversation = () => {
    setSearchParams({});
    setSendError('');
    setFailedText(null);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvId || sendMutation.isPending) return;
    sendMutation.mutate({ convId: selectedConvId, text: inputText.trim() });
  };

  const handleRetrySend = () => {
    if (!failedText || !selectedConvId || sendMutation.isPending) return;
    sendMutation.mutate({ convId: selectedConvId, text: failedText });
  };

  const getOtherName = (conv: Conversation) => {
    if (user?.role === 'WORKER') {
      return conv.employer?.organization_name || conv.employer?.full_name || t('roles.EMPLOYER', 'Employer');
    }
    return conv.worker?.full_name || t('roles.WORKER', 'Worker');
  };

  const getOtherAvatar = (conv: Conversation) => {
    if (user?.role === 'WORKER') {
      return conv.employer?.profile_image_url;
    }
    return conv.worker?.profile_image_url;
  };

  const convList = conversations.filter((c) => {
    const name = getOtherName(c);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ── Full-screen Active Chat View (Covers bottom navigation, clears soft keyboard) ──
  if (selectedConvId) {
    const otherName = activeConversation ? getOtherName(activeConversation) : t('nav.messages', 'Messages');
    const avatarUrl = activeConversation ? getOtherAvatar(activeConversation) : null;
    const isChatClosed = activeConversation?.application_status === 'COMPLETED' || activeConversation?.application_status === 'REJECTED';

    return (
      <div className="mobile-fullscreen-editor">
        {/* Chat Top Bar */}
        <header className="mobile-header-safe bg-white">
          <div className="flex h-14 items-center gap-2.5 px-2.5">
            <button
              type="button"
              onClick={closeConversation}
              className="mobile-touch-target rounded-full p-2 text-slate-700 hover:bg-slate-100 active:scale-95"
              aria-label={t('mobile:common.back', 'Back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-900 text-white font-bold text-xs shadow-sm overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={otherName} className="h-full w-full object-cover" />
              ) : (
                otherName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm text-slate-900 truncate">{otherName}</h2>
              {activeConversation?.application_status && (
                <MobileStatusBadge status={activeConversation.application_status} variant="application" />
              )}
            </div>
            <button
              type="button"
              onClick={() => void refetchMessages()}
              className="mobile-touch-target rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label={t('mobile:sync.refresh', 'Refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 bg-[#F5F6FA]">
          {isMessagesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-11 w-2/3 rounded-2xl mobile-skeleton" />
              ))}
            </div>
          ) : messagesList.length > 0 ? (
            messagesList.map((msg: Message) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium shadow-xs leading-relaxed break-words ${
                      isMine
                        ? 'bg-indigo-900 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400">
                    <span>
                      {msg.sent_at
                        ? new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                    {isMine &&
                      (msg.is_read ? (
                        <CheckCheck className="h-3 w-3 text-indigo-600" />
                      ) : (
                        <Check className="h-3 w-3 text-slate-400" />
                      ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs py-12">
              <MessageSquare className="h-10 w-10 mb-2 stroke-[1.5]" />
              <p>{t('messages.sayHello', 'Say hello to start the conversation!')}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sticky Message Composer cleared above keyboard & system bar */}
        <div className="mobile-sticky-footer">
          {sendError && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-[11px] text-red-700">
              <span className="truncate">{sendError}</span>
              {failedText && (
                <button
                  type="button"
                  onClick={handleRetrySend}
                  className="font-bold text-red-800 underline flex-shrink-0"
                >
                  {t('mobile:sync.retry', 'Retry')}
                </button>
              )}
            </div>
          )}

          {isChatClosed ? (
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 bg-slate-100 rounded-xl">
              <Lock className="h-3.5 w-3.5" />
              <span>{t('messages.closedNotice', 'Messaging is closed for completed or rejected applications.')}</span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('messages.typeMessagePlaceholder', 'Type your message...')}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium focus:bg-white focus:border-indigo-900 focus:outline-none min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sendMutation.isPending}
                className="mobile-touch-target rounded-full bg-indigo-900 p-3 text-white shadow-sm disabled:opacity-50 active:scale-95 transition-transform"
                aria-label={t('messages.send', 'Send')}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Conversation List View (Renders inside main layout scroll area) ──
  return (
    <div className="flex flex-col">
      <MobilePageHeader
        title={t('nav.messages', 'Messages')}
        subtitle={t('messages.subTitle', 'Direct chat with shortlisted or hired connections')}
        showBack={false}
        rightSlot={
          <button
            type="button"
            onClick={() => void refetchConvs()}
            className="mobile-touch-target rounded-full p-2 text-slate-600 hover:bg-slate-100"
            aria-label={t('mobile:sync.refresh', 'Refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('messages.searchPlaceholder', 'Search conversations...')}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-xs font-medium shadow-xs focus:border-indigo-900 focus:outline-none min-h-[44px]"
          />
        </div>

        {isConvsLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-2xl mobile-skeleton" />
            ))}
          </div>
        ) : isConvsError ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-red-100 shadow-sm mt-4">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-red-700">
              {t('messages.loadError', 'Could not load conversations')}
            </p>
            <button
              type="button"
              onClick={() => void refetchConvs()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-semibold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t('mobile:sync.retry', 'Retry')}</span>
            </button>
          </div>
        ) : convList.length > 0 ? (
          <div className="space-y-2.5">
            {convList.map((conv) => {
              const name = getOtherName(conv);
              const avatarUrl = getOtherAvatar(conv);
              const unread = conv.unread_count || 0;
              return (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => openConversation(conv.id)}
                  className="mobile-card w-full p-3.5 flex items-center gap-3 text-left active:scale-[0.99]"
                >
                  <div className="relative flex-shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-900 text-white font-bold text-sm overflow-hidden">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        name.charAt(0).toUpperCase()
                      )}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white border border-white">
                        {unread}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm truncate ${unread > 0 ? 'font-extrabold text-slate-900' : 'font-bold text-slate-800'}`}>
                        {name}
                      </h3>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${unread > 0 ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                        {conv.last_message?.content || t('messages.startChat', 'Start chatting...')}
                      </p>
                      <MobileStatusBadge status={conv.application_status} variant="application" className="text-[9px] px-1.5 py-0" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-8 text-center border border-slate-100 shadow-sm mt-4">
            <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-sm">{t('messages.noConversations', 'No Messages Yet')}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {t('messages.noConversationsDesc', 'When you get shortlisted or hire a worker, you can message directly here.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileMessagesPage;
