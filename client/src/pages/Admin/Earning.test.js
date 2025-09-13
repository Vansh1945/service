
// Conceptual Unit Test for downloadReport function in Earning.jsx

// Mocking global objects and functions
const mockShowToast = jest.fn(); // Assuming showToast is a mockable function from useAuth
const mockLogoutUser = jest.fn(); // Assuming logoutUser is a mockable function from useAuth

const mockFetch = jest.fn();
const mockCreateObjectURL = jest.fn(() => 'mock-object-url');
const mockRevokeObjectURL = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockClick = jest.fn();

// Simulate the DOM environment for testing link creation and clicking
const mockCreateElement = jest.fn((tagName) => {
  if (tagName === 'a') {
    return {
      href: '',
      download: '',
      click: mockClick,
      setAttribute: (attr, value) => {
        if (attr === 'download') {
          this.download = value;
        }
      },
    };
  }
  return null;
});

global.fetch = mockFetch;
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;
global.document.createElement = mockCreateElement;
global.document.body.appendChild = mockAppendChild;
global.document.body.removeChild = mockRemoveChild;

// Mocking localStorage for token
const localStorageMock = (function () {
  let store = {};
  return {
    getItem: function (key) {
      return store[key] || null;
    },
    setItem: function (key, value) {
      store[key] = value.toString();
    },
    clear: function () {
      store = {};
    },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mocking useAuth hook
jest.mock('../../store/auth', () => ({
  useAuth: () => ({
    API: 'http://localhost:5000/api',
    isAdmin: true,
    logoutUser: mockLogoutUser,
    showToast: mockShowToast,
    token: 'mock-token',
  }),
}));

// Import the component containing the downloadReport function
// For a real test, you would import the component and potentially extract the function
// For this conceptual test, we'll simulate the function directly.
// In a real scenario, you'd render the component and trigger the download via user interaction.

// --- Conceptual downloadReport function (as it would be in Earning.jsx) ---
const downloadReport = async (type, API, showToast, token, setLoading, startDate, endDate) => {
  try {
    setLoading(true);
    if (!token) {
      showToast('Please login to download reports', 'error');
      setLoading(false);
      return;
    }

    const endpoint = type === 'pdf' ? 'generate-report' : 'generate-report-excel';
    const queryParams = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const response = await fetch(`${API}/admin/${endpoint}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download report');
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to download report: ${response.status} ${response.statusText} - ${errorText}`);
      }
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-earnings-report.${type === 'pdf' ? 'pdf' : 'xlsx'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showToast(`${type.toUpperCase()} report downloaded successfully`);
  } catch (error) {
    console.error('Error downloading report:', error);
    showToast(error.message || 'Failed to download report', 'error');
  } finally {
    setLoading(false);
  }
};
// --- End of conceptual downloadReport function ---

describe('downloadReport function', () => {
  let setLoading;
  let startDate;
  let endDate;
  let API;
  let token;

  beforeEach(() => {
    // Reset mocks before each test
    mockFetch.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    mockAppendChild.mockClear();
    mockRemoveChild.mockClear();
    mockClick.mockClear();
    mockShowToast.mockClear();
    mockLogoutUser.mockClear();
    localStorageMock.clear();

    setLoading = jest.fn();
    startDate = new Date('2025-01-01T00:00:00.000Z');
    endDate = new Date('2025-01-31T23:59:59.999Z');
    API = 'http://localhost:5000/api';
    token = 'mock-token';
    localStorage.setItem('token', token);
  });

  test('should successfully download an Excel report', async () => {
    const mockBlob = new Blob(['mock excel data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      blob: () => Promise.resolve(mockBlob),
    });

    await downloadReport('excel', API, mockShowToast, token, setLoading, startDate, endDate);

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/admin/generate-report-excel?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-object-url');
    expect(mockShowToast).toHaveBeenCalledWith('EXCEL report downloaded successfully', 'success');
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  test('should show an error toast if API call fails (non-JSON error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('Something went wrong on the server'),
      json: () => Promise.reject(new Error('Not JSON')), // Ensure json() fails if content-type is not json
    });

    await downloadReport('excel', API, mockShowToast, token, setLoading, startDate, endDate);

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Failed to download report: 500 Internal Server Error - Something went wrong on the server',
      'error'
    );
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  test('should show an error toast if API call fails (JSON error)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ message: 'Invalid date range' }),
    });

    await downloadReport('excel', API, mockShowToast, token, setLoading, startDate, endDate);

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Invalid date range', 'error');
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  test('should show an error toast if token is missing', async () => {
    localStorageMock.clear(); // Clear token for this test

    await downloadReport('excel', API, mockShowToast, null, setLoading, startDate, endDate); // Pass null token

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(mockFetch).not.toHaveBeenCalled(); // No API call should be made
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockClick).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('Please login to download reports', 'error');
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  test('should successfully download a PDF report', async () => {
    const mockBlob = new Blob(['mock pdf data'], { type: 'application/pdf' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      blob: () => Promise.resolve(mockBlob),
    });

    await downloadReport('pdf', API, mockShowToast, token, setLoading, startDate, endDate);

    expect(setLoading).toHaveBeenCalledWith(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API}/admin/generate-report?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-object-url');
    expect(mockShowToast).toHaveBeenCalledWith('PDF report downloaded successfully', 'success');
    expect(setLoading).toHaveBeenCalledWith(false);
  });
});
