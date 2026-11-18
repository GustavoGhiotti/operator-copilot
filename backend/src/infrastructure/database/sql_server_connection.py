from src.shared.utils.env_load import *
from typing import List, Dict, Tuple
import time
import pyodbc
import random


class SQLServerTransaction:
    def __init__(self, conexao: pyodbc.Connection):
        self._conexao = conexao

    def execute_fetch(self, *, query: str, parametros:Tuple|List[Tuple], one: bool = False) -> List[Dict]| Dict | None:
        with self._conexao.cursor() as cursor:
            cursor.execute(query, parametros)

            if cursor.description:
                colunas = [c[0] for c in cursor.description]
            else:
                colunas = []

            if one:
                result = cursor.fetchone()
            else:
                result = cursor.fetchall()

            if result and one:
                return dict(zip(colunas, result))
            elif result and not one:
                return [dict(zip(colunas, linha)) for linha in result]

            return None

    def execute_commit(
        self,
        *,
        query: str,
        parametros:Tuple|List[Tuple],
        return_rowcount: bool = False
    ) -> int | None:
        with self._conexao.cursor() as cursor:
            if isinstance(parametros, list):
                cursor.fast_executemany = True
                cursor.executemany(query, parametros)
            else:
                cursor.execute(query, parametros)

            return cursor.rowcount if return_rowcount else None

    def execute_insert_returning(self,*,query: str,parametros: tuple) -> dict | None:
        with self._conexao.cursor() as cursor:
            cursor.execute(query,parametros)
            result = cursor.fetchone()

            if cursor.description and result:
                colunas = [c[0] for c in cursor.description]
                return dict(zip(colunas,result))

            return None

    def commit(self) -> None:
        self._conexao.commit()

    def rollback(self) -> None:
        self._conexao.rollback()

    def close(self) -> None:
        self._conexao.close()

class SQLServerConnection():
    """
    Implementação da conexão com SQL Server usando pyodbc,
    com retry e backoff em caso de deadlock (1205).
    Permite escolher qual servidor/banco usar.
    """

    def __init__(self, server: str, database: str):
        """
        :param server: Nome da variável de ambiente que contém o servidor (ex: 'DB_66')
        :param database: Nome do banco de dados (ex: 'DB_EMAIL')
        """
        self.__ipServidor = server
        self.__banco = database
        self.__usuario = DB_USER
        self.__senha = DB_PASSWORD
    
    def _connect(self) -> pyodbc.Connection: 
        return pyodbc.connect("DRIVER={ODBC Driver 17 for SQL Server};"
                              f"SERVER={self.__ipServidor};"
                              f"DATABASE={self.__banco};"
                              f"UID={self.__usuario};"
                              f"PWD={self.__senha};"
                              "TrustServerCertificate=YES"
                              )
    
    def begin_transaction(self) -> SQLServerTransaction:
        conexao = self._connect()
        conexao.autocommit = False
        return SQLServerTransaction(conexao)
    
    def execute_fetch(self, *, query: str, parametros:Tuple|List[Tuple], one: bool = False) -> List[Dict]| Dict | None:
        conexao = None  
        try:
            conexao = self._connect()

            with conexao.cursor() as cursor:
                cursor.execute(query, parametros)

                if cursor.description:
                    colunas = [c[0] for c in cursor.description]
                else:
                    colunas = []
                
                if one:
                    result = cursor.fetchone()
                else:
                    result = cursor.fetchall()

                if result and one: 
                    return dict(zip(colunas, result))
                elif result and not one:
                    return [dict(zip(colunas, l)) for l in result]

                return None
            
        except pyodbc.Error as e:
            print(f"Erro no banco: {e}")

        finally:
            if conexao is not None:
                try:
                    conexao.close()
                except:
                    pass

    def execute_commit(self, *, query: str, parametros:Tuple|List[Tuple], return_rowcount: bool = False) -> int | None:
        conexao = None
        is_many = isinstance(parametros, list)  # detecta executemany

        try:
            conexao = self._connect()
            cursor = conexao.cursor()

            if is_many:
                # executemany
                cursor.fast_executemany = True
                cursor.executemany(query, parametros)
                conexao.commit()
                print(f"[SQL] executemany OK — {len(parametros)} registros inseridos")
                return cursor.rowcount if return_rowcount else None

            else:
                # execute tradicional
                cursor.execute(query, parametros)
                conexao.commit()
                return cursor.rowcount if return_rowcount else None
        
        except Exception as e:
            print(f"Erro no banco: {e}")

        finally:
            if conexao is not None:
                try:
                    conexao.close()
                except:
                    pass
    
    def execute_insert_returning(self,*,query: str,parametros: tuple) -> dict | None:
        conexao = None
        try:
            conexao = self._connect()

            with conexao.cursor() as cursor:
                cursor.execute(query,parametros)
                result = cursor.fetchone()
                conexao.commit()

                if cursor.description and result:
                    colunas = [c[0] for c in cursor.description]
                    return dict(zip(colunas,result))

                return None

        except pyodbc.Error as e:
            print(f"Erro no banco: {e}")
            raise

        finally:
            if conexao:
                conexao.close()
