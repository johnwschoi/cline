import React from "react"

/**
 * HelloWorldBanner - A simple "Hello World" banner component (INF-814)
 */
const HelloWorldBanner: React.FC = () => {
	return (
		<div
			style={{
				background: "linear-gradient(90deg, #4f8ef7 0%, #a259f7 100%)",
				color: "#fff",
				textAlign: "center",
				padding: "12px 24px",
				fontWeight: "bold",
				fontSize: "1.2rem",
				letterSpacing: "0.05em",
				borderRadius: "6px",
				margin: "8px 0",
				boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
			}}>
			👋 Hello, World!
		</div>
	)
}

export default HelloWorldBanner
