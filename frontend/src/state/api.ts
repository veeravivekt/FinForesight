import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_BASE_URL || "http://localhost:3000/api",
  credentials: "include",
  prepareHeaders: (headers, { getState }) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  
  if (result.error && result.error.status === 401) {
    // Try to refresh token
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          body: { refreshToken },
        },
        api,
        extraOptions
      );
      
      if (refreshResult.data) {
        localStorage.setItem("accessToken", refreshResult.data.accessToken);
        localStorage.setItem("refreshToken", refreshResult.data.refreshToken);
        
        // Retry original query
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed, logout
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }
  }
  
  return result;
};

export const api = createApi({
  baseQuery: baseQueryWithReauth,
  reducerPath: "main",
  tagTypes: ["Kpis", "Products", "Transactions", "User"],
  endpoints: (build) => ({
    // Auth endpoints
    register: build.mutation({
      query: (credentials) => ({
        url: "/auth/register",
        method: "POST",
        body: credentials,
      }),
    }),
    login: build.mutation({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),
    logout: build.mutation({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
    }),
    getCurrentUser: build.query({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),
    
    // Transaction endpoints
    getTransactions: build.query({
      query: (params) => ({
        url: "/transactions",
        params,
      }),
      providesTags: ["Transactions"],
    }),
    getTransaction: build.query({
      query: (id) => `/transactions/${id}`,
      providesTags: ["Transactions"],
    }),
    createTransaction: build.mutation({
      query: (transaction) => ({
        url: "/transactions",
        method: "POST",
        body: transaction,
      }),
      invalidatesTags: ["Transactions"],
    }),
    updateTransaction: build.mutation({
      query: ({ id, ...transaction }) => ({
        url: `/transactions/${id}`,
        method: "PUT",
        body: transaction,
      }),
      invalidatesTags: ["Transactions"],
    }),
    deleteTransaction: build.mutation({
      query: (id) => ({
        url: `/transactions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Transactions"],
    }),
    getTransactionStats: build.query({
      query: (params) => ({
        url: "/transactions/stats/summary",
        params,
      }),
      providesTags: ["Transactions"],
    }),
    
    // ML endpoints
    detectFraud: build.mutation({
      query: (transaction) => ({
        url: "/ml/fraud/detect",
        method: "POST",
        body: { transaction },
      }),
    }),
    predictSpend: build.mutation({
      query: (params) => ({
        url: "/ml/predict/spend",
        method: "POST",
        body: params,
      }),
    }),
    
    // Legacy KPI endpoint (for existing dashboard)
    getKpis: build.query<void, void>({
      query: () => "kpi/kpis/",
      providesTags: ["Kpis"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useGetTransactionsQuery,
  useGetTransactionQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useGetTransactionStatsQuery,
  useDetectFraudMutation,
  usePredictSpendMutation,
  useGetKpisQuery,
} = api;
