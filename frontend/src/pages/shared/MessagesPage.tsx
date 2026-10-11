import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { chatApi } from '../../api/services';
import type { Conversation, Message } from '../../types';
import { Send, Check, CheckCheck, Loader2, MessageSquareOff } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

export default function MessagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const conversationParam = searchParams.get('conversation');

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationParam);

  // Sync URL param to state
  useEffect(() => {
    if (conversationParam && conversationParam !== activeConversationId) {
      setActiveConversationId(conversationParam);
    }
  }, [conversationParam]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setSearchParams({ conversation: id }, { replace: true });
  };

  const [messageInput, setMessageInput] = useState('');

  // 1. Fetch Conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.getConversations,
    refetchInterval: 5000, // Poll every 5s for unread counts & new conversations
  });

  // 2. Fetch Active Conversation Messages
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => chatApi.getMessages(activeConversationId!),
    enabled: !!activeConversationId,
    refetchInterval: 3000, // Poll every 3s for new messages in active chat
  });

  // 3. Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (convId: string) => chatApi.markAsRead(convId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    }
  });

  // 4. Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ convId, content }: { convId: string, content: string }) => 
      chatApi.sendMessage(convId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageInput('');
      scrollToBottom();
    }
  });

  // Side effect: Mark as read when messages load or active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const conv = conversations.find(c => c.id === activeConversationId);
      if (conv && conv.unread_count > 0) {
        markAsReadMutation.mutate(activeConversationId);
      }
    }
  }, [activeConversationId, messagesData, conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData?.items]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversationId) return;
    sendMessageMutation.mutate({ convId: activeConversationId, content: messageInput });
  };

  const getOtherParticipant = (conv: Conversation) => {
    if (user?.role === 'WORKER') {
      return {
        name: conv.employer.organization_name || conv.employer.full_name,
        image: conv.employer.profile_image_url
      };
    } else {
      return {
        name: conv.worker.full_name,
        image: conv.worker.profile_image_url
      };
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex">
      {/* Left Sidebar - Conversations List */}
      <div className={`w-full md:w-1/3 border-r border-gray-200 flex flex-col ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">{t('messages.title') || 'Messages'}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
              <MessageSquareOff className="w-12 h-12 mb-4 text-gray-400" />
              <p>{t('messages.noConversations') || 'No conversations yet'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {conversations.map((conv) => {
                const otherUser = getOtherParticipant(conv);
                const isActive = conv.id === activeConversationId;
                
                return (
                  <li 
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      {otherUser.image ? (
                        <img src={otherUser.image} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                          {otherUser.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {otherUser.name}
                          </h3>
                          {conv.last_message_at && (
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <p className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                            {conv.last_message ? conv.last_message.content : t('messages.startedConversation') || 'Conversation started'}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right Sidebar - Active Chat */}
      <div className={`w-full md:w-2/3 flex flex-col ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {activeConversationId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    setActiveConversationId(null);
                    setSearchParams({}, { replace: true });
                  }}
                  className="md:hidden mr-2 text-gray-500 hover:text-gray-700"
                >
                  &larr; Back
                </button>
                {activeConversation && getOtherParticipant(activeConversation).image ? (
                  <img src={getOtherParticipant(activeConversation).image!} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                    {activeConversation && getOtherParticipant(activeConversation).name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {activeConversation && getOtherParticipant(activeConversation).name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {activeConversation?.application_status}
                  </p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {loadingMessages ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {messagesData?.items.map((msg: Message) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-900 rounded-tl-none'}`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={`flex items-center justify-end mt-1 space-x-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                            <span className="text-[10px]">
                              {format(new Date(msg.sent_at), 'HH:mm')}
                            </span>
                            {isMe && (
                              msg.is_read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={t('messages.typeMessage') || 'Type a message...'}
                  className="flex-1 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 px-4 py-2"
                  disabled={sendMessageMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Send className="w-6 h-6" />
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 bg-gray-50">
            <MessageSquareOff className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg">{t('messages.selectConversation') || 'Select a conversation to start messaging'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
