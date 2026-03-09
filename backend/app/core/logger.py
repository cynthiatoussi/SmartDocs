# backend/app/core/logger.py

# loguru : librairie de logs moderne et lisible
# Bien plus simple que le module logging standard de Python
import sys
from loguru import logger

# On importe settings pour récupérer le niveau de log défini dans le .env
from app.core.config import settings


def setup_logger() -> None:
    """
    Configure le logger global de SmartDocs.
    À appeler une seule fois au démarrage de l'application dans main.py.
    """

    # Supprime le handler par défaut de loguru
    # pour éviter les doublons de logs dans le terminal
    logger.remove()

    # ── Handler Terminal ──────────────────────────────────────────
    # Ajoute un handler qui écrit les logs dans le terminal
    # format : heure | niveau | fichier:ligne | message
    logger.add(
        # sys.stdout : écrit dans le terminal
        sys.stdout,

        # Niveau minimum de log à afficher
        # Défini dans le .env — INFO par défaut
        level=settings.LOG_LEVEL,

        # Format d'affichage de chaque ligne de log
        # {time} : heure du log
        # {level} : niveau (INFO, WARNING, ERROR...)
        # {name} : nom du fichier source
        # {line} : numéro de ligne
        # {message} : le message du log
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        ),

        # Active la colorisation dans le terminal
        colorize=True,
    )

    # ── Handler Fichier ───────────────────────────────────────────
    # Sauvegarde aussi les logs dans un fichier pour l'historique
    logger.add(
        # Chemin du fichier de log — un fichier par jour grâce à {time}
        "logs/smartdocs_{time:YYYY-MM-DD}.log",

        # Niveau minimum — on garde tout à partir de INFO dans les fichiers
        level="INFO",

        # Rotation : crée un nouveau fichier chaque jour à minuit
        rotation="00:00",

        # Rétention : supprime les fichiers de plus de 7 jours
        retention="7 days",

        # Compression : compresse les vieux fichiers en .gz
        compression="zip",

        # Format sans colorisation pour les fichiers texte
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} | {message}",
    )

    # Log de confirmation au démarrage
    logger.info("Logger SmartDocs initialisé avec le niveau : {}", settings.LOG_LEVEL)


# On exporte directement le logger de loguru
# Les autres fichiers importent ainsi :
# from app.core.logger import logger
# puis utilisent : logger.info("message")
__all__ = ["logger", "setup_logger"]