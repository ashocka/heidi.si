document.addEventListener("DOMContentLoaded", async () => {
    try {
        // 1. Fetch the HTML file from the server
        const response = await fetch('footer.html');
        if (!response.ok) throw new Error('Failed to load file');

        // 2. Convert the response to text string
        const html = await response.text();

        // 3. Inject it at the very bottom of the body (right before </body>)
        document.body.insertAdjacentHTML('beforeend', html);
        
    } catch (error) {
        console.error('Error loading HTML:', error);
    }
});