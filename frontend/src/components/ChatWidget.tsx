import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, X, Minimize2, Bot, User, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { chatbotService, type ChatMessage } from '../services/chatbot.service';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import './ChatWidget.css';

interface ChatWidgetProps {
  inline?: boolean;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ inline = false }) => {
  const { user } = useAuth();
  const { can } = usePermission();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(inline);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', text: 'Bonjour ! Comment puis-je vous aider dans vos projets aujourd\'hui ?', sender: 'bot', timestamp: new Date().toISOString() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const data = await chatbotService.sendMessage(inputValue);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "Désolé, j'ai rencontré un problème technique. Réessayez plus tard.",
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const isWidgetOpen = inline || isOpen;

  if (!inline) {
    if (!can('MESSAGING_USE')) return null;
    return (
      <div className="chat-widget-container">
        <button
          type="button"
          className="chat-toggle-btn"
          onClick={() => navigate('/messages')}
          aria-label="Ouvrir la messagerie"
          title="Messagerie"
        >
          <MessageSquare size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className={`chat-widget-container${inline ? ' inline' : ''}`}>
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="chat-window premium-card"
          >
            <div className="chat-header">
              <div className="bot-info">
                <div className="bot-avatar">
                  <Bot size={20} />
                </div>
                <div>
                  <h4>
                    {user?.role === 'Membre' ? 'Discussion Admin' : 
                     user?.role === 'Chef de Projet' ? 'Discussion Équipe' : 
                     'Assistant IA'}
                  </h4>
                  <span className="status">En ligne</span>
                </div>
              </div>
              <div className="header-btns">
              {!inline && (
                <>
                  <button onClick={() => setIsOpen(false)}><Minimize2 size={18} /></button>
                  <button onClick={() => setIsOpen(false)}><X size={18} /></button>
                </>
              )}
            </div>
          </div>

            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                  <div className="message-avatar">
                    {msg.sender === 'bot' ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className="message-content">
                    <p>{msg.text}</p>
                    <span className="time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="message-wrapper bot">
                  <div className="message-avatar"><Bot size={14} /></div>
                  <div className="message-content typing">
                    <Loader2 className="animate-spin" size={14} />
                    <span>L'assistant réfléchit...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="chat-input-area">
              <input 
                type="text" 
                placeholder="Posez votre question..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <button type="submit" disabled={!inputValue.trim() || isTyping}>
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ChatWidget;
