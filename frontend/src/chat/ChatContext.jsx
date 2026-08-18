import { createContext, useContext } from 'react';

export const ChatListContext = createContext(null);

export function useChatList() {
  return useContext(ChatListContext);
}