// tests/setup.js
// Setup global para tests

// Mock para Electron en tests
if (typeof window === 'undefined') {
  global.window = {
    require: jest.fn(),
  };
}

// Mock para ipcRenderer
global.mockIpcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  send: jest.fn()
};

// Configurar timeouts globales
jest.setTimeout(10000);

// Suprimir console.log en tests a menos que sea necesario
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.VERBOSE_TESTS) {
    originalConsoleLog(...args);
  }
};
