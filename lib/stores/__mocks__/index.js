/* eslint-env jest */

let lastStore = null;

const createStore = jest.fn().mockReturnValue(() => {
  const store = {
    downloadFile: jest
      .fn()
      .mockImplementation(() => Promise.resolve(store.FILE_PATH)),
    downloadFiles: jest
      .fn()
      .mockImplementation(() => Promise.resolve(store.FILE_PATHS)),
    listFiles: jest
      .fn()
      .mockImplementation(() => Promise.resolve(store.FILE_LIST)),
    downloadAll: jest
      .fn()
      .mockImplementation(() => Promise.resolve(store.FILE_PATHS)),
    getCapabilities: jest.fn(),
  };

  store.FILE = { name: 'file' };
  store.FILE_LIST = [createStore.FILE];
  store.FILE_PATH = '/path/to/some/file';
  store.FILE_PATHS = [createStore.FILE_PATH];
  store.CAPABILITIES = { TYPE: true };

  lastStore = store;
  return store;
});

createStore.getLastStore = () => lastStore;
module.exports = createStore;
