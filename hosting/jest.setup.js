// jestのセットアップファイル
require('@testing-library/jest-dom');

// グローバルオブジェクトのモック
global.window = Object.create(window);
global.window.firebase = {
  initializeApp: jest.fn(),
  database: jest.fn().mockReturnValue({
    ref: jest.fn().mockReturnThis(),
    once: jest.fn().mockResolvedValue({}),
    on: jest.fn(),
    set: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    child: jest.fn().mockReturnThis()
  })
};

// AudioContextのモック
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    frequency: { value: 0 },
    type: ''
  }),
  createGain: jest.fn().mockReturnValue({
    connect: jest.fn(),
    gain: { value: 0 }
  }),
  destination: {}
}));
global.webkitAudioContext = global.AudioContext;

// DOMイベントをモック
Object.defineProperty(window, 'DOMContentLoaded', {
  writable: true,
  value: jest.fn()
});

// コンソール関数のモック
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
};

// documentオブジェクトのモック拡張
document.body.appendChild = jest.fn();
document.body.removeChild = jest.fn(); 
