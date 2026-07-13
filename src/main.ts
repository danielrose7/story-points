import { LitElement, html } from 'lit';
import './components/home-page';
import './components/room-page';

export function navigate(path: string): void {
	history.pushState(null, '', path);
	window.dispatchEvent(new PopStateEvent('popstate'));
}

class AppRoot extends LitElement {
	static properties = {
		path: { state: true },
	};

	path = location.pathname;

	connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener('popstate', this.onPopState);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		window.removeEventListener('popstate', this.onPopState);
	}

	private onPopState = () => {
		this.path = location.pathname;
	};

	render() {
		const roomMatch = this.path.match(/^\/room\/([a-z0-9-]{1,64})$/);
		if (roomMatch) {
			return html`<points-room .roomId=${roomMatch[1]}></points-room>`;
		}
		// Anything else that isn't the front door is a lost URL — let the home
		// page own the "404, but you could make this a room" experience.
		return html`<points-home .lostPath=${this.path === '/' ? '' : this.path}></points-home>`;
	}
}

customElements.define('points-app', AppRoot);
