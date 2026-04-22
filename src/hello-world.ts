/**
 * Hello World Banner
 *
 * A simple hello world banner for the Cline extension.
 */

export function getHelloWorldBanner(): string {
	return `
╔══════════════════════════════════════╗
║                                      ║
║        Hello, World! 👋              ║
║        Welcome to Cline!             ║
║                                      ║
╚══════════════════════════════════════╝
`
}

// Log the banner when this module is loaded directly
if (require.main === module) {
	console.log(getHelloWorldBanner())
}
