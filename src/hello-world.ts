/**
 * Hello World Banner
 * INF-814: Create "hello world" banner in cline/cline
 */

export function printHelloWorldBanner(): void {
	const banner = `
╔══════════════════════════════════════╗
║                                      ║
║         Hello, World! 👋             ║
║         Welcome to Cline!            ║
║                                      ║
╚══════════════════════════════════════╝
`
	console.log(banner)
}

// Print the banner when this module is run directly
if (require.main === module) {
	printHelloWorldBanner()
}
