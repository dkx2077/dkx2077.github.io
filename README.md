# Personal Academic Homepage

This is a modern, responsive personal academic homepage built with Bootstrap 5, featuring automatic content loading from Markdown files and MathJax support for mathematical expressions.

## Features

- 📱 **Responsive Design**: Looks great on all devices
- 📝 **Markdown Support**: Write content in Markdown format
- 🔢 **MathJax Integration**: Display mathematical equations beautifully
- 🚀 **Fast Loading**: Optimized performance with CDN-hosted libraries
- 🔄 **Version Control**: Automatic cache busting for updates
- 🎨 **Modern UI**: Clean and professional design

## Project Structure

```
.
├── index.html              # Main HTML file
├── static/                 # Static assets
│   ├── assets/            # Images and other assets
│   │   └── main.css       # Main custom styles
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript files
│   │   └── modules/       # ES6 modules
│   └── json/              # JSON data files
├── contents/              # Content files
│   ├── config.yml        # Site configuration
│   ├── home.md          # Home section content
│   ├── publications.md  # Publications list
│   ├── awards.md        # Awards and honors
│   ├── project.md       # Projects (optional)
│   └── service.md       # Service/ongoing work
├── package.json         # Node.js dependencies
├── .eslintrc.json      # ESLint configuration
├── .prettierrc.json    # Prettier configuration
└── .github/            # GitHub specific files
    └── workflows/      # GitHub Actions workflows

```

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dkx2077/dkx2077.github.io.git
   cd dkx2077.github.io
   ```

2. **Install dependencies (optional, for development):**
   ```bash
   npm install
   ```

## Usage

### Running Locally

You can run the site locally using Python's built-in server:

```bash
npm run serve
# or
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Editing Content

1. **Site Configuration**: Edit `contents/config.yml` to update site metadata
2. **Section Content**: Edit the corresponding Markdown files in the `contents/` directory
3. **Styling**: Modify `static/css/main.css` for custom styles

### Content Format

#### Markdown Files
Write your content using standard Markdown syntax. The site supports:
- Headers
- Lists
- Links (automatically open in new tabs)
- Images
- Code blocks
- Tables
- Mathematical expressions using `$...$` for inline and `$$...$$` for display math

Example:
```markdown
## Research Interests

My research focuses on $f(x) = x^2$ and other mathematical concepts.

$$
\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

#### Configuration File
The `config.yml` file contains site-wide settings:
```yaml
title: Your Name's Homepage
page-top-title: Your Name
top-section-bg-text: Welcome to My Homepage!
home-subtitle: About Me
copyright-text: © 2024 Your Name
```

## Development

### Code Style
The project uses ESLint and Prettier for code formatting:

```bash
# Lint JavaScript files
npm run lint

# Format all files
npm run format
```

### Version Management
The site implements automatic cache busting through the version field in `package.json`. When you update the site, increment the version number in `package.json` to ensure users get the latest version.

## Deployment

The site is configured for GitHub Pages deployment:

1. Push changes to the `master` branch
2. GitHub Actions will automatically deploy the site
3. Access your site at `https://[username].github.io`

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Technologies Used

- **Frontend Framework**: Bootstrap 5.3.3
- **Icons**: Bootstrap Icons
- **Markdown Parser**: marked.js
- **YAML Parser**: js-yaml
- **Math Rendering**: MathJax 3
- **Fonts**: Google Fonts (Newsreader, Mulish, Kanit)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Feel free to fork this project and customize it for your own use. If you find any bugs or have suggestions for improvements, please open an issue or submit a pull request.

## Acknowledgments

- Bootstrap team for the excellent CSS framework
- All the open-source library maintainers
- GitHub Pages for free hosting
