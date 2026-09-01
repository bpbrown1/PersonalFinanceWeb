# PersonalFinanceWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.5.

## Development server

PrimeNG requires a local PrimeUI license before the application starts. Create an ignored
`.primeui-license` file in the project root containing only your license value, or set the
`PRIMEUI_LICENSE` environment variable.

To generate the runtime license file and start the local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To generate the runtime license file and build the project, run:

```bash
npm run build
```

CI and deployment environments should provide `PRIMEUI_LICENSE` through their secret store. The
generated `public/primeui-license.js` file and local `.primeui-license` file must not be committed.

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
