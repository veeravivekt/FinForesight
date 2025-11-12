import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TransactionForm from "../transaction-form";

// Mock the API
jest.mock("@/lib/api", () => ({
  api: {
    get: jest.fn(),
  },
}));

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

describe("TransactionForm", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
    );
  };

  it("renders form fields", () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <TransactionForm onSuccess={onSuccess} onCancel={onCancel} />
    );

    expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
  });

  it("renders submit and cancel buttons", () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <TransactionForm onSuccess={onSuccess} onCancel={onCancel} />
    );

    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <TransactionForm onSuccess={onSuccess} onCancel={onCancel} />
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    cancelButton.click();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows validation errors for empty required fields", async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();

    renderWithProviders(
      <TransactionForm onSuccess={onSuccess} onCancel={onCancel} />
    );

    const submitButton = screen.getByRole("button", { name: /save/i });
    submitButton.click();

    await waitFor(() => {
      expect(screen.getByText(/account is required/i)).toBeInTheDocument();
    });
  });
});

