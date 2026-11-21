import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

export interface ChatbotSettings {
  welcomeMessage: string;
  primaryColor: string;
  systemPrompt: string;
  chatMode: "standard" | "smart";
}

export interface ChatbotItem {
  _id: string;
  userId: string;
  name: string;
  businessName: string;
  businessEmail: string;
  knowledgeBase: string;
  allowedDomains: string[];
  status: "draft" | "active" | "disabled" | "paused";
  settings: ChatbotSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ChatbotsState {
  items: ChatbotItem[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  actionLoading: boolean;
}

const initialState: ChatbotsState = {
  items: [],
  status: "idle",
  error: null,
  actionLoading: false,
};

// Async Thunks
export const fetchChatbots = createAsyncThunk(
  "chatbots/fetchChatbots",
  async (userId: string | undefined, { rejectWithValue }) => {
    try {
      const url = userId ? `/api/chatbot?userId=${encodeURIComponent(userId)}` : "/api/chatbot";
      const response = await axios.get(url);
      if (response.data.success) {
        return response.data.data as ChatbotItem[];
      }
      return rejectWithValue(response.data.message || "Failed to fetch chatbots");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.message || err.message);
      }
      return rejectWithValue("An unexpected error occurred");
    }
  },
);

export const createChatbot = createAsyncThunk(
  "chatbots/createChatbot",
  async (payload: Partial<ChatbotItem>, { rejectWithValue }) => {
    try {
      const response = await axios.post("/api/chatbot", payload);
      if (response.data.success) {
        return response.data.data as ChatbotItem;
      }
      return rejectWithValue(response.data.message || "Failed to create chatbot");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.message || err.message);
      }
      return rejectWithValue("An unexpected error occurred");
    }
  },
);

export const updateChatbot = createAsyncThunk(
  "chatbots/updateChatbot",
  async (
    { id, data }: { id: string; data: Partial<ChatbotItem> },
    { rejectWithValue },
  ) => {
    try {
      const response = await axios.put(`/api/chatbot/${id}`, data);
      if (response.data.success) {
        return response.data.data as ChatbotItem;
      }
      return rejectWithValue(response.data.message || "Failed to update chatbot");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.message || err.message);
      }
      return rejectWithValue("An unexpected error occurred");
    }
  },
);

export const deleteChatbot = createAsyncThunk(
  "chatbots/deleteChatbot",
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`/api/chatbot/${id}`);
      if (response.data.success) {
        return id;
      }
      return rejectWithValue(response.data.message || "Failed to delete chatbot");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        return rejectWithValue(err.response?.data?.message || err.message);
      }
      return rejectWithValue("An unexpected error occurred");
    }
  },
);

const chatbotsSlice = createSlice({
  name: "chatbots",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Chatbots
    builder
      .addCase(fetchChatbots.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchChatbots.fulfilled, (state, action: PayloadAction<ChatbotItem[]>) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchChatbots.rejected, (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string) || "Failed to load chatbots";
      });

    // Create Chatbot
    builder
      .addCase(createChatbot.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createChatbot.fulfilled, (state, action: PayloadAction<ChatbotItem>) => {
        state.actionLoading = false;
        state.items.unshift(action.payload);
      })
      .addCase(createChatbot.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = (action.payload as string) || "Failed to create chatbot";
      });

    // Update Chatbot
    builder
      .addCase(updateChatbot.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updateChatbot.fulfilled, (state, action: PayloadAction<ChatbotItem>) => {
        state.actionLoading = false;
        const index = state.items.findIndex((item) => item._id === action.payload._id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      .addCase(updateChatbot.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = (action.payload as string) || "Failed to update chatbot";
      });

    // Delete Chatbot
    builder
      .addCase(deleteChatbot.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteChatbot.fulfilled, (state, action: PayloadAction<string>) => {
        state.actionLoading = false;
        state.items = state.items.filter((item) => item._id !== action.payload);
      })
      .addCase(deleteChatbot.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = (action.payload as string) || "Failed to delete chatbot";
      });
  },
});

export const { clearError } = chatbotsSlice.actions;

export default chatbotsSlice.reducer;
