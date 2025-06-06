# Personal Homepage :)

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
│   └── service.md       # Service/ongoing work
├── package.json         # Node.js dependencies
├── .eslintrc.json      # ESLint configuration
├── .prettierrc.json    # Prettier configuration
└── .github/            # GitHub specific files
    └── workflows/      # GitHub Actions workflows

```

#### Markdown Files
Write your content using standard Markdown syntax. The site supports:
- Headers
- Lists
- Links (automatically open in new tabs)
- Images
- Code blocks
- Tables
- Mathematical expressions using `$...$` for inline and `$$...$$` for display math


#### Configuration File
The `config.yml` file contains site-wide settings:
```yaml
title: Your Name's Homepage
page-top-title: Your Name
top-section-bg-text: Welcome to My Homepage!
home-subtitle: About Me
copyright-text: © 2024 Your Name
```


## Technologies Used

- **Frontend Framework**: Bootstrap 5.3.3
- **Icons**: Bootstrap Icons
- **Markdown Parser**: marked.js
- **YAML Parser**: js-yaml
- **Math Rendering**: MathJax 3
- **Fonts**: Google Fonts (Newsreader, Mulish, Kanit)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
