import { configureStore } from "@reduxjs/toolkit";
import chatbotsReducer from "./slices/chatbotsSlice";
import dashboardReducer from "./slices/dashboardSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      chatbots: chatbotsReducer,
      dashboard: dashboardReducer,
    },
    devTools: process.env.NODE_ENV !== "production",
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
