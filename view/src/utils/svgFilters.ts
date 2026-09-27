export function injectSVGFilters() {
    const svgHTML = `
    <svg style="width: 0; height: 0; position: absolute;" aria-hidden="true">
        <defs>
            <filter color-interpolation-filters="sRGB" id="fo76-text-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feOffset dx="3.5" dy="3.5" in="SourceGraphic" result="filterResult0"/>
                <feColorMatrix in="filterResult0" result="filterResult1" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
                <feGaussianBlur in="filterResult1" result="filterResult2" stdDeviation="2.8"/>
                <feComposite in="SourceGraphic" in2="filterResult2" operator="over" result="filterResult3"/>
            </filter>
        </defs>
    </svg>
    `;
    const div = document.createElement('div');
    div.innerHTML = svgHTML;
    if (div.firstElementChild) {
        document.body.appendChild(div.firstElementChild);
    }
}
