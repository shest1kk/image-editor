export const calculateFileSize = async (src) => {
    const response = await fetch(src);
    const blob = await response.blob();
    return blob.size;
  };