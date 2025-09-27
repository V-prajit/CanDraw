if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const [resource, options] = args;

    // Check if the request is for the /voice endpoint
    if (typeof resource === 'string' && resource.endsWith('/voice')) {
      const response = await originalFetch(resource, options);

      // Clone the response so we can read the body twice
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();

      // Check if the response contains audio data
      if (data && data.payload && data.payload.audio) {
        const audioDataUri = data.payload.audio;
        const audio = new Audio(audioDataUri);
        audio.play().catch(error => console.error("Audio playback failed:", error));
      }

      // Return the original response for CedarCopilot to handle (text rendering)
      return response;
    }

    // For all other requests, use the original fetch
    return originalFetch(resource, options);
  };

  console.log("Audio interceptor initialized.");
}
