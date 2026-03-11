export default function AppFooter() {
  const commitShort = import.meta.env.VITE_APP_COMMIT_SHORT || (import.meta.env.DEV ? 'deadc0d' : '');

  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="footer-links">
          <a href="https://www.mirrorsedgearchive.org/">The Mirror&apos;s Edge Archive Homepage</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.reddit.com/r/mirrorsedge/" target="_blank" rel="noreferrer">/r/mirrorsedge</a>
          <span aria-hidden="true">•</span>
          <a href="https://github.com/mirrorsedgearchive/mediaview" target="_blank" rel="noreferrer">GitHub</a>
          {commitShort && <span className="footer-build">(build {commitShort})</span>}
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/terms-of-use.html">Terms of use</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/privacy-policy.html">Privacy &amp; cookies</a>
          <span aria-hidden="true">•</span>
          <a href="https://www.mirrorsedgearchive.org/legal/takedown.html">DMCA</a>
        </div>
      </div>
      <div className="footer-body">
        <p>
          Contents in this archive may be protected by applicable copyright laws. The inclusion does not imply that we represent these contents as our intellectual property.
          Applicable copyright and/or licensing terms should be considered before using, distributing or adapting any potentially copyrighted content.
          All rights remain with the original owners. This non-profit, open-source project is for entertainment purposes only and not affiliated with EA Digital Illusions CE, Electronic Arts or the Mirror&apos;s Edge franchise.
          Mirror&apos;s Edge is a registered trademark of EA Digital Illusions CE. All trademarks and registered trademarks belong to their respective owners.
        </p>
      </div>
    </footer>
  );
}
