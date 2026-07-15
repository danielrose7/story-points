import { LitElement, html, css } from 'lit';
import { baseStyles } from './base-styles';
import footerLinks from '../../shared/footer-links.json';

/**
 * Site-wide footer: link columns from shared/footer-links.json (the docs
 * builder renders the same data), plus the Silverton mountain credit.
 * Colors ride the page-background tokens so it works on any theme.
 */
class SiteFooter extends LitElement {
	static styles = [
		baseStyles,
		css`
		:host {
			display: block;
			width: 100%;
			max-width: 820px;
			color: var(--sp-on-bg);
			font-size: 0.85rem;
		}
		.cols {
			display: grid;
			grid-template-columns: minmax(180px, 1.4fr) repeat(3, minmax(110px, 1fr));
			gap: 28px 32px;
			padding: 8px 16px 24px;
		}
		@media (max-width: 640px) {
			.cols {
				grid-template-columns: 1fr 1fr;
			}
			.brand-block {
				grid-column: 1 / -1;
			}
		}
		.brand-title {
			font-weight: 800;
			font-size: 1rem;
			margin-bottom: 6px;
		}
		.brand-tagline {
			opacity: 0.7;
			line-height: 1.45;
			max-width: 24ch;
		}
		.group-title {
			font-size: 0.72rem;
			text-transform: uppercase;
			letter-spacing: 0.1em;
			opacity: 0.6;
			margin-bottom: 8px;
		}
		.group a {
			display: block;
			color: inherit;
			text-decoration: none;
			opacity: 0.85;
			padding: 2px 0;
		}
		.group a:hover {
			opacity: 1;
			text-decoration: underline;
		}
		.bottom {
			display: flex;
			flex-wrap: wrap;
			align-items: baseline;
			justify-content: space-between;
			gap: 6px 24px;
			margin: 0 16px;
			padding: 14px 0 6px;
			border-top: 1px solid color-mix(in srgb, var(--sp-on-bg) 25%, transparent);
		}
		.legal {
			opacity: 0.55;
			font-size: 0.78rem;
		}
		.mountain-link {
			display: inline-block;
			text-decoration: none;
			color: inherit;
		}
		/* Flat gradient underline at rest; hovering swaps in a jagged mountain
		   ridge with a scrolling gradient. Both images are data-URI SVGs built
		   in firstUpdated() from the theme's --sp-confetti colors. */
		.mountain-label {
			display: inline;
			background-repeat: no-repeat;
			background-position: 0 100%;
			background-size: 100% 16px;
			padding-bottom: 10px;
			background-image: var(--ridge-rest);
		}
		.mountain-link:hover .mountain-label {
			background-image: var(--ridge-hover);
		}
		`,
	];

	firstUpdated(): void {
		// The ridge can't use var() inside a data-URI SVG, so build both
		// images from the theme's tokens (same trick as confetti).
		const style = getComputedStyle(this);
		const confetti = style
			.getPropertyValue('--sp-confetti')
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean);
		const accent = style.getPropertyValue('--sp-accent').trim();
		const [c1, c2, c3] = [confetti[0] ?? accent, confetti[1] ?? accent, confetti[2] ?? accent];
		const uri = (svg: string) => `url("data:image/svg+xml;charset=utf8,${encodeURIComponent(svg)}")`;
		const rest =
			`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 16'>` +
			`<defs><linearGradient id='g' x1='0' y1='0' x2='300' y2='0' gradientUnits='userSpaceOnUse'>` +
			`<stop offset='0' stop-color='${c1}'/><stop offset='.5' stop-color='${c2}'/><stop offset='1' stop-color='${c3}'/>` +
			`</linearGradient></defs><line x1='0' y1='12' x2='300' y2='12' stroke='url(#g)' stroke-width='2'/></svg>`;
		const hover =
			`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 16'>` +
			`<defs><linearGradient id='g' x1='0' y1='0' x2='600' y2='0' gradientUnits='userSpaceOnUse'>` +
			`<stop offset='0' stop-color='${c1}'/><stop offset='.17' stop-color='${c2}'/><stop offset='.33' stop-color='${c3}'/>` +
			`<stop offset='.5' stop-color='${c1}'/><stop offset='.67' stop-color='${c2}'/><stop offset='.83' stop-color='${c3}'/>` +
			`<stop offset='1' stop-color='${c1}'/>` +
			`<animateTransform attributeName='gradientTransform' type='translate' from='0' to='-300' dur='3s' repeatCount='indefinite'/>` +
			`</linearGradient></defs>` +
			`<path fill='none' stroke='url(#g)' stroke-width='2' stroke-linejoin='round' ` +
			`d='M0,14 L15,12 L35,10 L55,4 L65,8 L80,7 L100,6 L120,6 L140,5 L155,3 L165,5 L175,4 L185,6 L205,1 L220,5 L240,7 L255,4 L270,8 L285,11 L300,13'/></svg>`;
		this.style.setProperty('--ridge-rest', uri(rest));
		this.style.setProperty('--ridge-hover', uri(hover));
	}

	render() {
		return html`
			<div class="cols">
				<div class="brand-block">
					<div class="brand-title">${footerLinks.brand.title}</div>
					<div class="brand-tagline">${footerLinks.brand.tagline}</div>
				</div>
				${footerLinks.groups.map(
					(g) => html`
						<div class="group">
							<div class="group-title">${g.title}</div>
							${g.links.map((l) => html`<a href=${l.href}>${l.label}</a>`)}
						</div>
					`,
				)}
			</div>
			<div class="bottom">
				<a class="mountain-link" href=${footerLinks.credit.href} target="_blank" rel="noopener noreferrer">
					<span class="mountain-label">${footerLinks.credit.label}</span>
				</a>
				<span class="legal">${footerLinks.legal}</span>
			</div>
		`;
	}
}

customElements.define('points-footer', SiteFooter);
