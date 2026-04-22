import { memo } from "react"

/**
 * HelloWorldBanner - A simple "Hello World" banner component (INF-814)
 */
const HelloWorldBanner = memo(() => {
	return (
		<div
			className="w-full rounded-md px-4 py-3 text-center font-semibold text-base"
			style={{
				background: "var(--vscode-button-background)",
				color: "var(--vscode-button-foreground)",
				border: "1px solid var(--vscode-button-border, transparent)",
			}}>
			👋 Hello World!
		</div>
	)
})

export default HelloWorldBanner
