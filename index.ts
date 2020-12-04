import { apply, branchAndMerge, chain, externalSchematic, mergeWith, move, renameTemplateFiles, Rule, SchematicContext, SchematicsException, template, Tree, url } from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';
import { normalize, parse, ParsedPath } from 'path';
import { strings } from '@angular-devkit/core';
import * as ts from 'typescript';

import {
  stringUtils,
  buildRelativePath,
  insertImport,
  InsertChange,
  findModuleFromOptions,
  addImportToModule,
} from '@ngrx/schematics/schematics-core';




function updateModule(schema: any): Rule {
  return (tree: Tree) => {
    const statePath = `/${schema.path}/store/${schema.name}.reducers.ts`;
    const modulePath = findModuleFromOptions(tree, schema);

    if (!tree.exists(modulePath)) {
      throw new Error(`Specified module path ${modulePath} does not exist`);
    }

    const text = tree.read(modulePath);
    if (text === null) {
      throw new SchematicsException(`File ${modulePath} does not exist.`);
    }
    const sourceText = text.toString('utf-8');

    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );
    
    const relativePath = buildRelativePath(modulePath, statePath);

      console.log("relativePath", relativePath)
    // import * as fromDashboard from './store/dashboard.reducers'
    const storeStoreModule = addImportToModule(
      source,
      modulePath,
     `StoreModule.forFeature(from${stringUtils.classify(
            schema.name
          )}.${stringUtils.camelize(
            schema.name
          )}FeatureKey, from${stringUtils.classify(
            schema.name
          )}.reducers)`,
      relativePath
    ).shift();
    
    const storeEffectsModule = addImportToModule(
      source,
      modulePath,
     `EffectsModule.forFeature([${stringUtils.classify( schema.name )}Effects])`,
      relativePath
    ).shift();


    let commonImports = [
      storeStoreModule,
      storeEffectsModule,
      insertImport(source, modulePath, `* as from${stringUtils.classify( schema.name )}`, relativePath, true),
      insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
      insertImport(source, modulePath, 'EffectsModule', '@ngrx/effects'),
      insertImport(source, modulePath, `${stringUtils.classify( schema.name )}Effects`, `./store/${schema.name}.effects`),
    ];


    const changes = [...commonImports];
    // console.log("changes",changes);
    const recorder = tree.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    tree.commitUpdate(recorder);

    return tree

  };
}




export default function (schema: any): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const path: ParsedPath = parse(schema.name);
    schema.name = path.name;
    schema.path = normalize(path.dir);
    schema.srcPath = getProjectConfig(tree, 'hpo').root;
    const statePath = `/${schema.path}/store/${schema.name}.reducers.ts`;
    const environmentsPath = buildRelativePath(
      statePath,
      `/${schema.srcPath}/src/environments/environment`
    );

    const templateSource = apply(url('./files'), [
      template({
        ...strings,
        INDEX: schema.index,
        name: schema.name,
        environmentsPath
      }),
      renameTemplateFiles(),
      move(schema.path),
    ]);

    return chain([branchAndMerge(chain([updateModule(schema), mergeWith(templateSource)]))])(
      tree,
      context
    );
  };
}

