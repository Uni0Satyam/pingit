import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  createChatbot,
  deleteChatbot,
  updateChatbot,
} from "./chatbotsSlice";
import type { ChatbotItem } from "./chatbotsSlice";

type DashboardTab =
  | "chatbots"
  | "conversations"
  | "analytics"
  | "billing"
  | "settings"
  | "embed";
type ChatbotFilter = "all" | "draft" | "active" | "disabled";

export interface DashboardState {
  activeTab: DashboardTab;
  filterStatus: ChatbotFilter;
  searchQuery: string;
  selectedChatbot: ChatbotItem | null;
  isCreateModalOpen: boolean;
}

const initialState: DashboardState = {
  activeTab: "chatbots",
  filterStatus: "all",
  searchQuery: "",
  selectedChatbot: null,
  isCreateModalOpen: false,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<DashboardTab>) => {
      state.activeTab = action.payload;
    },
    setFilterStatus: (state, action: PayloadAction<ChatbotFilter>) => {
      state.filterStatus = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setSelectedChatbot: (state, action: PayloadAction<ChatbotItem | null>) => {
      state.selectedChatbot = action.payload;
    },
    setIsCreateModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isCreateModalOpen = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createChatbot.fulfilled, (state) => {
        state.isCreateModalOpen = false;
      })
      .addCase(updateChatbot.fulfilled, (state, action) => {
        if (state.selectedChatbot?._id === action.payload._id) {
          state.selectedChatbot = action.payload;
        }
      })
      .addCase(deleteChatbot.fulfilled, (state, action) => {
        if (state.selectedChatbot?._id === action.payload) {
          state.selectedChatbot = null;
        }
      });
  },
});

export const {
  setActiveTab,
  setFilterStatus,
  setSearchQuery,
  setSelectedChatbot,
  setIsCreateModalOpen,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
