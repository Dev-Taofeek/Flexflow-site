const socket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
};

module.exports = { io: jest.fn(() => socket), socket };
